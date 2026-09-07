import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/Button";
import { requireCmsAdmin } from "@/lib/cms/auth";
import { listCoinProducts, reorderCoinProducts, updateCoinProductActive } from "@/lib/cms/billing";
import { adminPath, billingListPath } from "@/lib/routes";

export default async function AdminBillingPage() {
  const context = await requireCmsAdmin(billingListPath);

  if (context.status === "forbidden") {
    return (
      <main className="min-h-screen bg-deep px-4 py-10 text-bone">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-bone/70">You are not authorized for CMS access.</p>
        </div>
      </main>
    );
  }

  const products = await listCoinProducts();

  async function toggleCoinProductAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(billingListPath);

    if (guard.status !== "authorized") {
      return;
    }

    const code = formData.get("code")?.toString() ?? "";
    const currentlyActive = formData.get("active") === "on";

    await updateCoinProductActive(code, !currentlyActive);
    revalidatePath(billingListPath);
  }

  async function reorderCoinProductAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(billingListPath);

    if (guard.status !== "authorized") {
      return;
    }

    const code = formData.get("code")?.toString() ?? "";
    const direction = formData.get("direction")?.toString() ?? "up";

    const orderedProducts = await listCoinProducts();
    const codes = orderedProducts.map((product) => product.code);
    const index = codes.indexOf(code);

    if (index < 0) {
      return;
    }

    const target = direction === "up" ? index - 1 : index + 1;

    if (target < 0 || target >= codes.length) {
      return;
    }

    const newOrder = [...codes];
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];

    await reorderCoinProducts(newOrder);
    revalidatePath(billingListPath);
  }

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/60">
              0nya CMS
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Billing</h1>
            <p className="mt-1 max-w-xl text-sm text-bone/60">
              Coin pack catalog. Quantities (coin_amount) are CMS/config-controlled; real-money prices
              live in store metadata and are not editable here.
            </p>
          </div>
          <Link href={adminPath} className="text-sm text-teal">
            ← Back to admin
          </Link>
        </div>

        <div className="mt-8 divide-y divide-bone/10 border border-bone/10">
          {products.length === 0 && (
            <p className="px-4 py-6 text-sm text-bone/60">No coin products configured.</p>
          )}
          {products.map((product, index) => {
            const isFirst = index === 0;
            const isLast = index === products.length - 1;

            return (
              <div key={product.code} className="flex items-center justify-between gap-4 px-4 py-4">
                <div>
                  <p className="font-medium">{product.display_name}</p>
                  <p className="text-xs text-bone/50">
                    code: {product.code} · {product.coin_amount} coins · sort {product.sort_order}
                  </p>
                </div>

                <span
                  className={`border px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] ${
                    product.active
                      ? "text-teal border-teal/50"
                      : "text-bone/30 border-bone/10"
                  }`}
                >
                  {product.active ? "Active" : "Inactive"}
                </span>

                <div className="flex items-center gap-1">
                  <form action={reorderCoinProductAction}>
                    <input type="hidden" name="code" value={product.code} />
                    <input type="hidden" name="direction" value="up" />
                    <Button type="submit" variant="ghost" disabled={isFirst}>
                      ↑
                    </Button>
                  </form>
                  <form action={reorderCoinProductAction}>
                    <input type="hidden" name="code" value={product.code} />
                    <input type="hidden" name="direction" value="down" />
                    <Button type="submit" variant="ghost" disabled={isLast}>
                      ↓
                    </Button>
                  </form>
                  <form action={toggleCoinProductAction}>
                    <input type="hidden" name="code" value={product.code} />
                    <input type="hidden" name="active" value={product.active ? "on" : ""} />
                    <Button type="submit" variant="secondary">
                      {product.active ? "Disable" : "Enable"}
                    </Button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
