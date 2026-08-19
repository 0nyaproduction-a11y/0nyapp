import { dataResponse, errorResponse } from "@/lib/api/responses";
import { getApiAuth } from "@/lib/api/auth";
import { getUserWallet } from "@/lib/entitlements";
import {
  formatOrderStatus,
  formatPaymentProvider,
  getActiveCoinProducts,
  getUserPaymentOrders,
} from "@/lib/payments";
import { getUserCoinTransactions } from "@/lib/purchases";

export async function GET(request: Request) {
  const { supabase, user } = await getApiAuth(request);

  if (!user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  const [wallet, coinProducts, coinTransactions, paymentOrders] =
    await Promise.all([
      getUserWallet(user.id, supabase),
      getActiveCoinProducts(supabase),
      getUserCoinTransactions(user.id, supabase),
      getUserPaymentOrders(user.id, supabase),
    ]);

  return dataResponse({
    balance: wallet?.coin_balance ?? 0,
    coinProducts: coinProducts.map((product) => ({
      code: product.code,
      coinAmount: product.coin_amount,
      displayName: product.display_name,
    })),
    recentTransactions: coinTransactions.slice(0, 12).map((transaction) => ({
      amount: transaction.amount,
      type: transaction.transaction_type,
      createdAt: transaction.created_at,
    })),
    recentTopUps: paymentOrders.map((order) => ({
      status: formatOrderStatus(order),
      provider: formatPaymentProvider(order.provider),
      coinAmount: order.coin_amount,
      completedAt: order.completed_at,
      createdAt: order.created_at,
    })),
  });
}
