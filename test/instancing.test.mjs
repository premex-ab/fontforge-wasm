import test from 'node:test';import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {convert,inspectVariations} from '../src/index.js';
const input=await readFile(new URL('./fixtures/variable.ttf',import.meta.url));
test('axes expose real ranges and static instances differ by selected weight',async()=>{
 assert.deepEqual(await inspectVariations(input),[{tag:'wght',name:'Weight',min:400,default:400,max:700}]);
 const regular=await convert(input,{format:'ttf',variations:{}}),bold=await convert(input,{format:'ttf',variations:{wght:700}});
 assert.notDeepEqual(regular,bold);assert.deepEqual(await inspectVariations(regular),[]);assert.deepEqual(await inspectVariations(bold),[]);
 await mkdir('test/results',{recursive:true});await writeFile('test/results/instance-400.ttf',regular);await writeFile('test/results/instance-700.ttf',bold);
 for(const format of ['svg','pfb','pfm','otf'])assert((await convert(input,{format,variations:{wght:600}})).length>30);
});
test('compressed fonts expose axes and can instantiate without dropping characters',async()=>{
 const compressed=await convert(input,{format:'woff2'});assert.deepEqual(await inspectVariations(compressed),await inspectVariations(input));
 const instance=await convert(compressed,{format:'ttf',variations:{wght:550}});assert.deepEqual(await inspectVariations(instance),[]);
 await writeFile('test/results/instance-550.ttf',instance);
});
test('unknown, invalid and out-of-range coordinates fail instead of producing an unintended instance',async()=>{
 for(const variations of [{nope:400},{wght:701},{wght:NaN},{wght:'700'},null,[]])await assert.rejects(convert(input,{format:'ttf',variations}),{code:'INVALID_VARIATION'});
 const original=await convert(input,{format:'ttf'});assert.equal((await inspectVariations(original)).length,1);
});
