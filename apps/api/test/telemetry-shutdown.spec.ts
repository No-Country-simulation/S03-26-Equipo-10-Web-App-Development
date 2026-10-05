describe('Telemetry shutdown', () => {
  it('awaits and invokes the SDK shutdown once through the Nest lifecycle hook', async () => {
    const originalEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    const start = jest.fn();
    let finishShutdown: (() => void) | undefined;
    const shutdown = jest.fn().mockImplementation(() => new Promise<void>(resolve => {
      finishShutdown = resolve;
    }));
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = 'http://127.0.0.1:4318/v1/traces';
    jest.doMock('@opentelemetry/sdk-node', () => ({
      NodeSDK: jest.fn().mockImplementation(() => ({ start, shutdown })),
    }));
    jest.doMock('@opentelemetry/auto-instrumentations-node', () => ({
      getNodeAutoInstrumentations: jest.fn().mockReturnValue([]),
    }));
    jest.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({
      OTLPTraceExporter: jest.fn(),
    }));

    try {
      let close: Promise<void> | undefined;
      jest.isolateModules(() => {
        const { TelemetryShutdownService } = jest.requireActual<
          typeof import('../src/common/observability/telemetry-shutdown.service')
        >('../src/common/observability/telemetry-shutdown.service');
        close = new TelemetryShutdownService().onApplicationShutdown();
      });

      let completed = false;
      void close?.then(() => { completed = true; });
      await Promise.resolve();
      expect(completed).toBe(false);
      finishShutdown?.();
      await close;
      expect(completed).toBe(true);
      expect(start).toHaveBeenCalledTimes(1);
      expect(shutdown).toHaveBeenCalledTimes(1);
    } finally {
      if (originalEndpoint === undefined) delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
      else process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = originalEndpoint;
      jest.dontMock('@opentelemetry/sdk-node');
      jest.dontMock('@opentelemetry/auto-instrumentations-node');
      jest.dontMock('@opentelemetry/exporter-trace-otlp-http');
    }
  });
});
