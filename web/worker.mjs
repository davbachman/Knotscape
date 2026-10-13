import {createEngine} from './engine.mjs';
const engine=createEngine();
self.onmessage=async({data})=>{
  try {self.postMessage({result:await engine.execute(data.action,data.payload)});}
  catch(error){self.postMessage({error:error.message||String(error)});}
};
