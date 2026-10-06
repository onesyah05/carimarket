import { z } from "zod";

export const articleFieldsSchema = z.object({
  title: z.string().trim().min(4, "Judul minimal 4 karakter.").max(191),
  slug: z.string().trim().max(191).optional(),
  excerpt: z.string().trim().max(500).optional(),
  content: z.string().trim().min(40, "Konten minimal 40 karakter."),
  coverImageUrl: z.string().trim().url({ message: "URL gambar tidak valid." }).max(512).optional().or(z.literal("")),
  categoryName: z.string().trim().max(100).optional(),
  tags: z.array(z.string().trim().max(100)).max(10).optional(),
  metaTitle: z.string().trim().max(191).optional(),
  metaDescription: z.string().trim().max(320).optional(),
});
