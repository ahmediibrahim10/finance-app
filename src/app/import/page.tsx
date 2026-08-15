"use client";

import { useEffect, Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addExpense } from "@/services/transactionService";
import { db } from "@/db";

function ImportHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasProcessed = useRef(false);
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const processImport = async () => {
      if (hasProcessed.current) return;
      hasProcessed.current = true;

      try {
        const rawAmount = searchParams.get("amount");
        const rawMerchant = searchParams.get("merchant");

        if (!rawAmount || !rawMerchant) {
          throw new Error("Missing required fields: amount or merchant.");
        }

        const amount = parseFloat(rawAmount);
        if (isNaN(amount) || amount <= 0) {
          throw new Error("Invalid transaction amount.");
        }

        const merchant = decodeURIComponent(rawMerchant).trim().replace(/[<>]/g, "");
        if (!merchant) {
          throw new Error("Merchant name cannot be empty.");
        }

        const categories = await db.categories.toArray();
        let targetCategory = categories[0];

        const lowerMerchant = merchant.toLowerCase();
        if (lowerMerchant.includes("starbucks") || lowerMerchant.includes("coffee") || lowerMerchant.includes("قهوة")) {
          targetCategory = categories.find(c => c.name.toLowerCase() === "coffee") || targetCategory;
        } else if (lowerMerchant.includes("uber") || lowerMerchant.includes("careem")) {
          targetCategory = categories.find(c => c.name.toLowerCase() === "transport") || targetCategory;
        } else {
          targetCategory = categories.find(c => c.name.toLowerCase() === "other") || targetCategory;
        }

       await addExpense(
  amount, 
  merchant, 
  targetCategory ? targetCategory.id : "default", 
  'sms', 
  "Automated via SMS"
);

        setStatus("success");
        setTimeout(() => router.replace("/"), 1200);

      } catch (error: any) {
        console.error("Import error:", error);
        setStatus("error");
        setErrorMessage(error.message || "Couldn't import transaction.");
      }
    };

    processImport();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 max-w-sm w-full text-center space-y-4">
        {status === "processing" && (
          <>
            <div className="text-4xl animate-bounce">⚡</div>
            <h1 className="font-bold text-lg text-gray-900">Importing transaction...</h1>
            <p className="text-xs text-gray-400">Processing secure local import</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-4xl">✅</div>
            <h1 className="font-bold text-lg text-gray-900">Transaction added!</h1>
            <p className="text-xs text-gray-500">Redirecting to dashboard...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-4xl">❌</div>
            <h1 className="font-bold text-lg text-red-600">Couldn't import transaction</h1>
            <p className="text-xs text-gray-500 bg-red-50 p-3 rounded-xl border border-red-100">{errorMessage}</p>
            <button
              onClick={() => router.replace("/")}
              className="w-full bg-black text-white p-3 rounded-xl text-sm font-bold mt-2"
            >
              Back to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-400">Loading import gateway...</div>}>
      <ImportHandler />
    </Suspense>
  );
}