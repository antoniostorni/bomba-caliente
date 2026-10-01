// Compila server/src/server.ts a build/server.js para que lo cargue host.mjs.
// Usa el mismo transpilado que los tests, así lo que se despliega es lo que se probó.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ts = createRequire(path.join(here, 'package.json'))('typescript');
const source = readFileSync(path.join(here, 'src', 'server.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
mkdirSync(path.join(here, 'build'), { recursive: true });
writeFileSync(path.join(here, 'build', 'server.mjs'), outputText);
console.log('server/build/server.mjs listo (' + outputText.length + ' bytes)');
