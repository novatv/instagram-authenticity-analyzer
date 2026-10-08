import Link from "next/link";
import { getProvider } from "@/providers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Setup — Instagram Authenticity Analyzer" };

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="panel flex gap-4 p-4">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/20 font-semibold text-accent">{n}</span>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <div className="mt-1 space-y-1 text-sm text-muted">{children}</div>
      </div>
    </li>
  );
}

export default function SetupPage() {
  const provider = getProvider();
  const hasToken = Boolean(process.env.META_GRAPH_ACCESS_TOKEN);
  const hasId = Boolean(process.env.META_IG_BUSINESS_ACCOUNT_ID);
  return (
    <div className="space-y-6">
      <div className="pt-4">
        <h1 className="text-3xl font-semibold tracking-tight">Conectar datos reales</h1>
        <p className="mt-2 max-w-3xl text-muted">La app no hace scraping ni se salta las restricciones de Instagram. Para analizar cuentas reales (la tuya o la de cualquier artista con cuenta profesional pública) hay que conectar la API oficial de Meta. El token es tu llave; las cuentas que consultas son las de otros.</p>
      </div>

      <div className={`rounded-lg border p-4 text-sm ${provider.isDemo ? "border-warn/40 bg-warn/5" : "border-ok/40 bg-ok/5"}`}>
        <b>Estado actual:</b> {provider.name}.{" "}
        {provider.isDemo ? "Solo funcionan las cuentas de demo. Las cuentas reales devuelven INSUFFICIENT DATA." : "Las cuentas profesionales públicas se consultan con datos reales."}
        <div className="mt-2 text-xs text-muted">META_GRAPH_ACCESS_TOKEN: {hasToken ? "configurado" : "falta"} · META_IG_BUSINESS_ACCOUNT_ID: {hasId ? "configurado" : "falta"}</div>
      </div>

      <ol className="space-y-3">
        <Step n={1} title="Cuenta de Instagram Profesional vinculada a una página de Facebook">
          <p>En Instagram: Ajustes → Tipo de cuenta y herramientas → Cambiar a cuenta profesional (Creator o Business). Luego vincúlala a una página de Facebook (puede ser nueva).</p>
        </Step>
        <Step n={2} title="Crear una app en Meta for Developers">
          <p>Entra en <a className="text-accent hover:underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com/apps</a> → Crear app → tipo <b>Business</b>. El nombre da igual.</p>
        </Step>
        <Step n={3} title="Generar el token en el Graph API Explorer">
          <p>Abre <a className="text-accent hover:underline" href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noreferrer">developers.facebook.com/tools/explorer</a>, selecciona tu app y añade los permisos <code className="mono">instagram_basic</code>, <code className="mono">pages_show_list</code>, <code className="mono">pages_read_engagement</code> y <code className="mono">business_management</code>. Pulsa <b>Generate Access Token</b> y acepta con tu Facebook.</p>
        </Step>
        <Step n={4} title="Obtener el ID de tu cuenta profesional">
          <p>En el mismo Explorer ejecuta <code className="mono">me/accounts?fields=instagram_business_account</code> y copia el número de <code className="mono">instagram_business_account.id</code>.</p>
        </Step>
        <Step n={5} title="Guardar las credenciales en .env.local">
          <pre className="mono overflow-auto rounded-md bg-bg/70 p-3 text-xs text-text">{`INSTAGRAM_PROVIDER=meta-graph
META_GRAPH_ACCESS_TOKEN=EAAB...tu token...
META_IG_BUSINESS_ACCOUNT_ID=1784...`}</pre>
          <p>Reinicia el servidor (<code className="mono">npm run dev</code>). El token del Explorer caduca en 1–2 h; conviértelo en uno de larga duración (60 días) con <code className="mono">oauth/access_token?grant_type=fb_exchange_token</code>.</p>
        </Step>
      </ol>

      <div className="panel p-4 text-sm text-muted">
        <h3 className="font-semibold text-text">Qué obtendrás con datos reales</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><b className="text-text">De cualquier cuenta profesional pública</b>: seguidores, following, posts, likes y comentarios reales; engagement observado frente al esperado; likes anormalmente planos; posts atípicos; Engagement Quality Score.</li>
          <li><b className="text-text">Lo que ninguna API da de cuentas ajenas</b>: la lista de seguidores. El porcentaje de bots en la audiencia seguirá en INSUFFICIENT DATA salvo que el artista te envíe un export, que puedes cargar en <Link href="/import" className="text-accent hover:underline">Import data</Link>.</li>
          <li><b className="text-text">Cuentas personales</b> (no profesionales): Meta no las expone. Para un artista que se promociona, eso ya es una señal a considerar.</li>
        </ul>
      </div>
    </div>
  );
}
