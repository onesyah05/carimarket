export class ThreadsIntegrationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 500,
  ) {
    super(message);
    this.name = "ThreadsIntegrationError";
  }
}

export function publicThreadsError(error: unknown) {
  if (error instanceof ThreadsIntegrationError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  return { status: 500, body: { error: "Permintaan belum dapat diproses. Silakan coba lagi nanti.", code: "THREADS_INTERNAL_ERROR" } };
}
