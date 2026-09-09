import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { load } from 'js-yaml';

const readWorkflow = name =>
  load(readFileSync(`.github/workflows/${name}.yml`, 'utf8'));

test('fork publishing requires manual dispatch on the maintained branch', () => {
  const workflow = readWorkflow('fork-publish');
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.match(workflow.jobs.validate.if, /github.ref == 'refs\/heads\/fork'/);
  assert.match(
    workflow.jobs.validate.if,
    /github.repository == 'magrhino\/ShelfBridge'/,
  );
  assert.equal(workflow.jobs.publish.needs, 'validate');
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  for (const job of Object.values(workflow.jobs)) {
    const checkout = job.steps.find(step =>
      step.uses?.startsWith('actions/checkout@'),
    );
    assert.equal(checkout.with.ref, '${{ github.sha }}');
  }
});

test('moving tag promotion follows mandatory verification of both platforms', () => {
  const steps = readWorkflow('fork-publish').jobs.publish.steps;
  const build = steps.find(step => step.id === 'build');
  assert.equal(build.with.platforms, 'linux/amd64,linux/arm64');
  assert.equal(build.with.tags, '${{ env.IMAGE }}:sha-${{ github.sha }}');
  const verificationIndex = steps.findIndex(
    step => step.name === 'Verify published images',
  );
  const promotionIndex = steps.findIndex(
    step => step.name === 'Promote verified image to fork',
  );
  assert.ok(verificationIndex >= 0 && promotionIndex > verificationIndex);
  const verification = steps[verificationIndex];
  assert.match(verification.run, /run_native_test linux\/amd64/);
  assert.match(verification.run, /run_native_test linux\/arm64/);
  assert.match(verification.run, /npm run test:native-lifecycle/);
  assert.equal(verification.env.DIGEST, '${{ steps.build.outputs.digest }}');
  assert.match(steps[promotionIndex].run, /"\$IMAGE@\$DIGEST"/);
  for (const step of steps.slice(0, promotionIndex + 1)) {
    assert.equal(step['continue-on-error'], undefined);
    assert.equal(step.if, undefined);
  }
});

test('PR image builds never log in or push', () => {
  const job = readWorkflow('ci').jobs['docker-build'];
  assert.equal(job.permissions.packages, undefined);
  assert.ok(
    !job.steps.some(step => step.uses?.startsWith('docker/login-action@')),
  );
  const build = job.steps.find(step =>
    step.uses?.startsWith('docker/build-push-action@'),
  );
  assert.equal(build.with.push, false);
  assert.equal(build.with.load, true);
});
