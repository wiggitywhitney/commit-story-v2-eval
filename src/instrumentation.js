// ABOUTME: OpenTelemetry SDK initialization for commit-story-v2.
// ABOUTME: Bootstraps the NodeSDK with an instrumentations array for the telemetry agent to populate.

import { NodeSDK } from '@opentelemetry/sdk-node';

const instrumentations = [
  // Telemetry agent appends instrumentation entries here
];

const sdk = new NodeSDK({
  instrumentations,
});

sdk.start();

const shutdown = () => {
  sdk.shutdown()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error shutting down OTel SDK', err);
      process.exit(1);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default sdk;
