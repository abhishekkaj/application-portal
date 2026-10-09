import test from 'node:test';import assert from 'node:assert/strict';
import {scope,assertScope,sanitiseApplication,validateFile,duplicateKey,validateSubmission} from '../policy.js';
const p={role:'agent',status:'active',agencyId:'agency-1'},u={uid:'user-1',email:'test@example.com',emailVerified:true};
test('pending agencies and missing mappings cannot access records',()=>{assert.throws(()=>scope({...p,status:'pending'},u.uid));assert.throws(()=>scope({...p,agencyId:''},u.uid))});
test('one agency cannot access another agency records',()=>{assert.throws(()=>assertScope({scopeId:'agency:other'},p,u.uid));assert.doesNotThrow(()=>assertScope({scopeId:'agency:agency-1'},p,u.uid))});
test('guest scope is unique per authenticated anonymous identity',()=>{const g={role:'guest',status:'active'};assert.notEqual(scope(g,'one'),scope(g,'two'));assert.throws(()=>assertScope({scopeId:'user:one'},g,'two'))});
test('client cannot assign role, owner, status or recruiter',()=>{const a=sanitiseApplication({email:' Test@Example.com ',role:'admin',status:'Enrolled',ownerUid:'other',scopeId:'other',recruiterUid:'other',channel:'Direct'},p,u);assert.equal(a.channel,'B2B');for(const k of ['role','status','ownerUid','scopeId','recruiterUid'])assert.equal(a[k],undefined);assert.equal(a.email,'test@example.com')});
test('incomplete submission fails on server',()=>assert.throws(()=>validateSubmission(sanitiseApplication({},p,u))));
test('student application email must match verified identity',()=>assert.throws(()=>sanitiseApplication({email:'someone@example.com'},{role:'student',status:'active'},u)));
test('duplicate keys ignore email case but preserve agency scope',()=>{const a={email:'A@example.com',programme:'p',intake:'July'};assert.equal(duplicateKey(a,'one'),duplicateKey({...a,email:'a@example.com'},'one'));assert.notEqual(duplicateKey(a,'one'),duplicateKey(a,'two'))});
test('file validation rejects extension spoofing and oversized bytes',()=>{assert.throws(()=>validateFile('x.pdf','application/pdf',Buffer.from('not pdf')));assert.throws(()=>validateFile('x.pdf','application/pdf',Buffer.alloc(11*1024*1024)));assert.doesNotThrow(()=>validateFile('x.pdf','application/pdf',Buffer.from('%PDF-1.7 test')))});

test('unrecognised evidence categories are rejected',()=>assert.throws(()=>sanitiseApplication({docs:{Other:{id:'abcdefgh'}}},p,u)));
