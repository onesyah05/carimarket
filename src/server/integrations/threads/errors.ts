export class ThreadsIntegrationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 500,
    /**
     * Rincian teknis aman untuk log server (sudah disensor dari token/secret).
     * Tidak pernah dikirim ke klien oleh `publicThreadsError`.
     */
    public readonly diagnostics?: string,
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

/** Rincian untuk log server; mengembalikan string kosong bila tidak ada. */
export function threadsErrorDetail(error: unknown): string {
  if (error instanceof ThreadsIntegrationError) return error.diagnostics ?? error.code;
  return error instanceof Error ? error.name : "UNKNOWN_ERROR";
}
