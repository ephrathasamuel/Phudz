import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import {
  DEFAULT_FEE_USDC,
  DEFAULT_RATE_KES_PER_USDC,
  MAX_AMOUNT_USDC,
  MIN_AMOUNT_USDC,
  type AppConfig,
} from "@phundz/shared";
import type { QueryExecutor } from "./db/query-executor";
import { errorHandler, notFoundHandler } from "./errors/error-handler";
import { LiveProvider } from "./providers/live-provider";
import { MockProvider } from "./providers/mock-provider";
import type { PayoutProvider } from "./providers/types";
import { CashoutRepository } from "./repositories/cashout-repository";
import { QuoteRepository } from "./repositories/quote-repository";
import { WalletRepository } from "./repositories/wallet-repository";
import { registerCashoutRoutes } from "./routes/cashout-routes";
import { CashoutService } from "./services/cashout-service";

export interface AppOptions {
  db: QueryExecutor;
  webOrigin: string;
  payoutMode?: "mock" | "live";
  provider?: PayoutProvider;
  logger?: boolean;
}

/** Builds the app without listening, so tests can drive it with `inject()`. */
export async function createApp({
  db,
  webOrigin,
  payoutMode = "mock",
  provider,
  logger = false,
}: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger, forceCloseConnections: true });

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);
  // An array makes the plugin echo the origin only on an exact match.
  await app.register(cors, { origin: [webOrigin], methods: ["GET", "POST"] });

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/api/config", async (): Promise<AppConfig> => ({
    mode: payoutMode,
    currencyPair: "USDC/KES",
    defaultRateKesPerUsdc: DEFAULT_RATE_KES_PER_USDC,
    fixedFeeUsdc: DEFAULT_FEE_USDC,
    minAmountUsdc: MIN_AMOUNT_USDC,
    maxAmountUsdc: MAX_AMOUNT_USDC,
  }));

  const cashoutRepo = new CashoutRepository(db);
  const walletRepo = new WalletRepository(db);
  const quoteRepo = new QuoteRepository(db);

  let serviceRef: CashoutService;

  const resolvedProvider =
    provider ??
    (payoutMode === "live"
      ? new LiveProvider()
      : new MockProvider(async (payload) => {
          if (serviceRef) {
            try {
              await serviceRef.handlePayoutWebhook(payload);
            } catch {
              // Ignore if test database was truncated between test runs
            }
          }
        }));

  const service = new CashoutService(cashoutRepo, walletRepo, quoteRepo, resolvedProvider);
  serviceRef = service;

  registerCashoutRoutes(app, service);

  return app;
}
