"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Kolom kata sandi dengan tombol lihat.
 *
 * Kata sandi yang panjang sering salah ketik tanpa cara memeriksanya, dan di
 * ponsel kesalahan itu baru ketahuan setelah ditolak. Nilainya tetap
 * tersembunyi saat halaman dimuat: menampilkan selalu tindakan sadar dari
 * pemiliknya.
 */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  const describedBy = useId();
  const label = visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi";

  return (
    <div className="password-input">
      <input {...props} className={`input ${className ?? ""}`.trim()} type={visible ? "text" : "password"} />
      <button
        className="password-input__toggle"
        type="button"
        onClick={() => setVisible(current => !current)}
        aria-label={label}
        aria-pressed={visible}
        aria-describedby={describedBy}
        title={label}
        disabled={props.disabled}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
      <span className="sr-only" id={describedBy}>{visible ? "Kata sandi sedang terlihat." : "Kata sandi tersembunyi."}</span>
    </div>
  );
}
