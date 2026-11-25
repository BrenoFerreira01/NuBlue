import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-black">Página não encontrada</h1>
      <Link href="/" className="font-bold text-primary underline">
        Voltar ao início
      </Link>
    </div>
  );
}
