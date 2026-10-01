import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {suggestionForPredictions} from '../src/local-vision.js';

test('on-device classifier suggests a broad category but never invents condition or price',()=>{
  const result=suggestionForPredictions([{className:'power drill',probability:0.86}]);
  assert.equal(result.title,'Power drill');
  assert.equal(result.category,'Power tools');
  assert.equal(result.deposit_cents,undefined);
  assert.equal(result.condition,undefined);
});

test('uncertain or unrelated images leave listing fields untouched',()=>{
  assert.equal(suggestionForPredictions([{className:'computer keyboard',probability:0.91}]).title,undefined);
  assert.equal(suggestionForPredictions([{className:'saw',probability:0.04}]).title,undefined);
});
