/** Composition root: infrastructure assembled without domain policy. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ExerciseCatalog} from './src/server/catalog.mjs';
import {createApplication} from './src/server/http.mjs';
import {listenApplication} from './src/server/listen.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const catalog=await ExerciseCatalog.open(path.join(root,'examples'));
const server=createApplication({catalog,staticRoot:path.join(root,'public')});
const explicitPort=process.env.PORT!==undefined&&process.env.PORT!=='';
const port=explicitPort?Number(process.env.PORT):5173,host=process.env.HOST||'127.0.0.1';
try{
  const address=await listenApplication(server,{port,host,allowFallback:!explicitPort,
    onRetry:busy=>console.warn(`A(z) ${busy}-as port foglalt; próbálom a következő portot.`)});
  console.log(`ngDynamic Structural Engine v7 → http://${host}:${address.port}`);
}catch(error){
  console.error(error.code==='EADDRINUSE'
    ? `Nem indítható a szerver: a(z) ${host}:${port} cím foglalt. Válassz másik PORT értéket (PowerShell: $env:PORT=5174; npm start).`
    : `Nem indítható a szerver: ${error.message}`);
  process.exitCode=1;
}
