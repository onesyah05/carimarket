import "server-only";

export interface ReplyGenerator {
  generate(input: { contactName?: string; businessName: string; service: string; location?: string }): Promise<{ body: string; model: string; simulated: boolean }>;
}

export const deterministicReplyGenerator: ReplyGenerator = {
  async generate({ contactName = "Kak", businessName, service, location }) {
    const area = location ? ` untuk area ${location}` : "";
    return {
      body: `Halo ${contactName}, kami dari ${businessName} bisa membantu kebutuhan ${service}${area}. Jika berkenan, kami dapat mengirim contoh hasil dan estimasi yang sesuai konteks kebutuhannya.`,
      model: "deterministic-local-v1",
      simulated: true,
    };
  },
};
