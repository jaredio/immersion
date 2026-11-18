/* Give unchanged extension sources evaluated by VM-based tests their real filenames.
 * Test-only instrumentation: production code and VM execution are unchanged. */
import vm from 'node:vm';
import {readdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {syncBuiltinESMExports} from 'node:module';

const directory=new URL('../extension/',import.meta.url),sources=new Map();
for(const file of readdirSync(directory))if(file.endsWith('.js')){
  const url=new URL(file,directory);sources.set(readFileSync(url,'utf8'),fileURLToPath(url));
}
for(const name of ['runInContext','runInNewContext','runInThisContext']){
  const original=vm[name];
  vm[name]=function(source,...args){
    const filename=sources.get(source),index=name==='runInThisContext'?0:1;
    if(filename&&!args[index]?.filename)args[index]={...(typeof args[index]==='object'?args[index]:{}),filename};
    return Reflect.apply(original,this,[source,...args]);
  };
}
const OriginalScript=vm.Script;
vm.Script=class extends OriginalScript{
  constructor(source,options){
    const filename=sources.get(source);super(source,filename&&!options?.filename?{...options,filename}:options);
  }
};
syncBuiltinESMExports();
