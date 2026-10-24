/** Composition root: infrastructure assembled without domain policy. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ExerciseCatalog} from './src/server/catalog.mjs';
import {createApplication} from './src/server/http.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const catalog=await ExerciseCatalog.open(path.join(root,'examples'));
const server=createApplication({catalog,staticRoot:path.join(root,'public')});
const port=Number(process.env.PORT||5173),host=process.env.HOST||'127.0.0.1';
server.listen(port,host,()=>console.log(`ngDynamic Structural Engine v6 → http://${host}:${port}`));
