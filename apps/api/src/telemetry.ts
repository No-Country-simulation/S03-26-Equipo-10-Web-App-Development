import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

// Preload before Nest, Express, Prisma and Axios so instrumentation can patch imports.
const endpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
if (endpoint) {
  const sdk = new NodeSDK({
    serviceName: 'testimonial-cms-api',
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    instrumentations: [getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    })],
  });
  sdk.start();
  process.once('beforeExit', () => { void sdk.shutdown(); });
}
