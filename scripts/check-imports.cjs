// Checks every "@/..." import, re-export, dynamic import and vi.mock() in src/: the path must
// resolve to a file and each named import / mocked name must be a real export. tsc covers
// static imports, but not vi.mock factories, whose wrong names only fail at test time.
// Run with `npm run check:imports`.
const ts = require(require.resolve("typescript", { paths: [process.cwd()] }));
const path = require("path");
const fs = require("fs");
const cfg = ts.getParsedCommandLineOfConfigFile("tsconfig.json", {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
const program = ts.createProgram(cfg.fileNames, cfg.options);
const checker = program.getTypeChecker();
const resolveAt = (spec) => {
  const base = path.join(process.cwd(), "src", spec.slice(2));
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) if (fs.existsSync(base + ext)) return base + ext;
  return null;
};
const exportsOf = new Map();
const getExports = (file) => {
  if (!exportsOf.has(file)) {
    const sf = program.getSourceFile(file);
    const sym = sf && checker.getSymbolAtLocation(sf);
    exportsOf.set(file, new Set(sym ? checker.getExportsOfModule(sym).map((s) => s.name) : []));
  }
  return exportsOf.get(file);
};
let problems = 0, checked = 0;
const report = (sf, node, msg) => {
  const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
  console.log(`${path.relative(process.cwd(), sf.fileName)}:${line + 1}: ${msg}`);
  problems++;
};
for (const sf of program.getSourceFiles()) {
  if (sf.fileName.includes("node_modules") || !sf.fileName.includes("/src/")) continue;
  const visit = (node) => {
    let spec, names = [];
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      spec = node.moduleSpecifier.text;
      const nb = node.importClause?.namedBindings;
      if (nb && ts.isNamedImports(nb)) names = nb.elements.map((e) => (e.propertyName ?? e.name).text);
      if (node.importClause?.name) names.push("default");
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      spec = node.moduleSpecifier.text;
      if (node.exportClause && ts.isNamedExports(node.exportClause)) names = node.exportClause.elements.map((e) => (e.propertyName ?? e.name).text);
    } else if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      const callee = node.expression.getText(sf);
      if (callee === "vi.mock" || callee === "vi.doMock" || node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        spec = node.arguments[0].text;
        const factory = node.arguments[1];
        const body = factory && (ts.isArrowFunction(factory) || ts.isFunctionExpression(factory)) ? factory.body : null;
        let obj = body && ts.isParenthesizedExpression(body) ? body.expression : body;
        if (obj && ts.isBlock(obj)) {
          const ret = obj.statements.find(ts.isReturnStatement);
          obj = ret?.expression;
        }
        if (obj && ts.isObjectLiteralExpression(obj))
          names = obj.properties.filter((p) => p.name && !ts.isSpreadAssignment(p)).map((p) => p.name.getText(sf));
      }
    }
    if (spec && spec.startsWith("@/")) {
      checked++;
      const file = resolveAt(spec);
      if (!file) report(sf, node, `"${spec}" does not resolve to a file`);
      else {
        const ex = getExports(file);
        for (const n of names) if (!ex.has(n)) report(sf, node, `"${n}" is not exported by ${spec}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
console.log(`${checked} "@/" references checked, ${problems} problem(s).`);
process.exit(problems ? 1 : 0);
