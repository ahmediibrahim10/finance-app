export const translations = {
  en: {
    dashboard: {
      title: "Dashboard",
      subtitle: "Your daily financial status",
      safeToSpend: "Safe To Spend Today",
      spentToday: "Spent Today",
      remainingToday: "Remaining Today",
      monthlySpending: "Monthly Spending",
      forecast: "End of Month Forecast",
      recentActivity: "Recent Activity",
      seeAll: "See all",
      statusOnTrack: "You're on track",
      statusWarning: "WARNING: Close to budget limit",
      statusDanger: "DANGER: Overspending projected",
      noTransactions: "No transactions today."
    },
    analytics: {
      title: "Analytics",
      subtitle: "Monthly overview & insights",
      totalSpent: "Total Spent",
      dailyAvg: "Daily Average",
      smartInsights: "Smart Insights",
      spendingByCategory: "Spending by Category",
      forecast: "End of Month Forecast",
      noExpenses: "No expenses yet this month.",
      insightGood: "Great job! Your spending is well below the budget limit.",
      insightDanger: "DANGER: Your current spending rate will exceed your income!",
      insightWarning: "WARNING: You are close to consuming your entire budget.",
      insightCategory: (percent: number, cat: string) => `Over ${percent}% of your spending goes to ${cat}.`
    },
    settings: {
      title: "Settings",
      home: "Home",
      financialSetup: "Financial Setup",
      monthlyIncome: "Monthly Income",
      currency: "Currency",
      saveSettings: "Save Settings",
      manageFixed: "Manage Fixed Expenses",
      language: "App Language",
      dataManagement: "Data Management",
      export: "Export Backup",
      import: "Import Backup",
      dangerZone: "Danger Zone",
      clearOld: "Clear Old Transactions",
      alerts: {
        saved: "Settings saved successfully!",
        exportError: "Error exporting data.",
        importWarning: "Warning: This will overwrite all current data. Are you sure?",
        importSuccess: "Data restored successfully!",
        importError: "Error! Make sure the file is correct.",
        clearWarning: "Are you sure you want to delete all old transactions?"
      }
    },
    addExpense: {
      title: "Add Expense",
      merchant: "Merchant (e.g. Starbucks)",
      selectCategory: "Select Category",
      note: "Note (Optional)",
      save: "Save Transaction",
      saving: "Saving..."
    }
  },
  egyptian: {
    dashboard: {
      title: "الرئيسية",
      subtitle: "ملخص جيبك وحساباتك النهارده",
      safeToSpend: "تقدر تصرف كام بقلب جامد",
      spentToday: "طيرت كام النهارده",
      remainingToday: "فاضلك كام النهارده",
      monthlySpending: "إجمالي اللي اتصرف الشهر ده",
      forecast: "هتقفل الشهر على كام",
      recentActivity: "آخر حركاتك",
      seeAll: "شوف كله",
      statusOnTrack: "أدائك عنب، كمل كده!",
      statusWarning: "خد بالك: الميزانية بتودع",
      statusDanger: "يا ساتر: إنت عديت الليمت!",
      noTransactions: "مفيش أي مصاريف النهارده."
    },
    analytics: {
      title: "التحليلات",
      subtitle: "تفاصيل مصاريفك ووضعك الشهر ده",
      totalSpent: "إجمالي اللي صرفته",
      dailyAvg: "متوسط صرفك في اليوم",
      smartInsights: "نصايح في الجون",
      spendingByCategory: "فلوسك بتروح فين؟",
      forecast: "توقع مصاريفك لآخر الشهر",
      noExpenses: "لسه مصارفتش أي حاجة الشهر ده.",
      insightGood: "عاش! معدل صرفك أقل من الميزانية بكتير.",
      insightDanger: "يا ساتر! لو كملت صرف كده هتعدي مرتبك.",
      insightWarning: "خد بالك: قربت تخلص ميزانيتك كلها الشهر ده.",
      insightCategory: (percent: number, cat: string) => `أكتر من ${percent}% من فلوسك رايحة على ${cat}.`
    },
    settings: {
      title: "الإعدادات",
      home: "الرئيسية",
      financialSetup: "تظبيط الميزانية",
      monthlyIncome: "المرتب (الدخل الشهري)",
      currency: "العملة",
      saveSettings: "احفظ التظبيطات دي",
      manageFixed: "إدارة الفواتير والاشتراكات الثابتة",
      language: "لغة التطبيق",
      dataManagement: "بياناتك والنسخ الاحتياطية",
      export: "نزل نسخة من بياناتك (Export)",
      import: "رجع نسخة من بياناتك (Import)",
      dangerZone: "منطقة الخطر (خد بالك)",
      clearOld: "امسح كل الحركات القديمة",
      alerts: {
        saved: "تم الحفظ يا ريس!",
        exportError: "حصلت مشكلة وإحنا بننزل البيانات.",
        importWarning: "تحذير: هتمسح كل بياناتك الحالية وترجع النسخة دي. متأكد؟",
        importSuccess: "البيانات رجعت بنجاح والدنيا تمام!",
        importError: "حصلت مشكلة! اتأكد إن الملف سليم.",
        clearWarning: "متأكد إنك عايز تمسح كل العمليات القديمة وتصفر العداد؟"
      }
    },
    addExpense: {
      title: "سجل مصروف",
      merchant: "صرفتهم فين؟ (مثال: قهوة)",
      selectCategory: "اختار التصنيف",
      note: "ملاحظة (اختياري)",
      save: "احفظ العملية",
      saving: "بيحفظ..."
    }
  }
};