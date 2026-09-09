export const initialNavigation=()=>({nap:0,train:0,fuel:0,mezo:0,me:0});
export function resolveRoute(hash){const [key,index]=hash.replace(/^#/,'').split('/');const domain=Object.hasOwn(initialNavigation(),key)?key:'nap';const n=Number(index);return {domain,page:domain===key&&Number.isInteger(n)&&n>=0&&n<4?n:0};}
export function rememberRoute(state,domain,page){if(Object.hasOwn(state,domain)&&Number.isInteger(page)&&page>=0&&page<4)state[domain]=page;}
