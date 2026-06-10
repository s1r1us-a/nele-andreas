/* Resolve/Load-Hooks: leitet jeden Import von core/firebase.js auf ein
   In-Memory-Stub-Modul um (kein Netzwerk, kein Firebase-SDK). */
export async function resolve(specifier, context, nextResolve){
  if(specifier.endsWith('firebase.js')){
    return { url:'stub:firebase', shortCircuit:true };
  }
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad){
  if(url === 'stub:firebase'){
    const source = `
      export const db = null; export const auth = null;
      export const ref = () => null;
      export const get = async () => ({ exists:()=>false, val:()=>null });
      export const set = async () => {};
      export const update = async () => {};
      export const remove = async () => {};
      export const push = () => ({ key:'stub' });
      export const runTransaction = async () => {};
      export const onValue = () => {};
      export const onDisconnect = () => ({ set: async () => {}, remove: async () => {} });
      export let userKey = null;
      export function displayName(){ return null; }
    `;
    return { format:'module', source, shortCircuit:true };
  }
  return nextLoad(url, context);
}
