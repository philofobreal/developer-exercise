/** Bind the development server without disturbing another local application.
 * Only the implicit default port may fall back; explicit PORT remains a contract.
 */
export async function listenApplication(server,{host='127.0.0.1',port=5173,allowFallback=false,maxAttempts=10,onRetry=()=>{}}={}){
  if(!Number.isInteger(port)||port<0||port>65535)throw new RangeError('A PORT egész szám legyen 0 és 65535 között.');
  if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>20)throw new RangeError('Invalid listen attempt limit');
  for(let attempt=0;attempt<maxAttempts;attempt++){
    const candidate=port+attempt;
    if(candidate>65535)throw new RangeError('Nem található további érvényes port.');
    try{
      await new Promise((resolve,reject)=>{
        const cleanup=()=>{server.removeListener('error',failed);server.removeListener('listening',ready);};
        const failed=error=>{cleanup();reject(error);};
        const ready=()=>{cleanup();resolve();};
        server.once('error',failed);server.once('listening',ready);
        try{server.listen(candidate,host);}catch(error){failed(error);}
      });
      return server.address();
    }catch(error){
      if(error.code!=='EADDRINUSE'||!allowFallback||port===0||attempt+1>=maxAttempts)throw error;
      onRetry(candidate);
    }
  }
}
