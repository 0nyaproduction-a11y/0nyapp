import Module from "node:module";

const NodeModule = Module as unknown as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

const originalLoad = NodeModule._load;

NodeModule._load = function (this: unknown, request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") {
    return { __esModule: true, default: undefined };
  }
  return originalLoad.call(this, request, parent, isMain);
};

type JsonObject = Record<string, unknown>;

function getArg(name: string) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function emit(result: JsonObject) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function main() {
  const mode = getArg("mode") ?? "precheck";
  const qaUserId = getArg("qa-user-id") ?? requireEnv("N04_QA_USER_ID");
  const pushDeviceId = getArg("push-device-id") ?? requireEnv("N04_QA_PUSH_DEVICE_ID");
  const { precheckQaPushTarget, processQaPushReceipt, sendQaPushVerification } = await import(
    "@/lib/notification-qa-verification"
  );

  if (mode === "precheck") {
    const precheck = await precheckQaPushTarget({ qaUserId, pushDeviceId });
    emit({
      mode,
      safeToSend: true,
      precheck,
    });
    return;
  }

  if (mode === "send") {
    const confirmation = requireEnv("N04_REAL_PUSH_CONFIRM");
    if (confirmation !== "SEND_EXACTLY_ONE_QA_PUSH") {
      throw new Error("N04_REAL_PUSH_CONFIRM must equal SEND_EXACTLY_ONE_QA_PUSH.");
    }

    const result = await sendQaPushVerification({
      qaUserId,
      pushDeviceId,
      allowRealPushSend: true,
    });

    emit({
      mode,
      realPushSent: true,
      realPushCount: 1,
      notificationId: result.notification.id,
      type: result.notification.type,
      sendResult: result.sendResult,
      precheck: result.precheck,
    });
    return;
  }

  if (mode === "receipt") {
    const notificationId = getArg("notification-id");
    if (!notificationId) throw new Error("--notification-id is required for receipt mode.");
    const receiptResult = await processQaPushReceipt(notificationId);
    emit({
      mode,
      notificationId,
      receiptResult,
    });
    return;
  }

  throw new Error(`Unsupported mode: ${mode}`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
