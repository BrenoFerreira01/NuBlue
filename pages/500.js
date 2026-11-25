import Link from "next/link";

export default function ServerError() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-black">Algo deu errado</h1>
      <p className="text-muted-foreground">
        Tente de novo em alguns instantes.
      </p>
      <Link href="/" className="font-bold text-primary underline">
        Voltar ao início
      </Link>
    </div>
  );
}
