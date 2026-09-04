import { db } from "@/lib/db";

export default async function Page() {
  // Quick DB check
  let serviceCount = 0;
  try {
    serviceCount = await db.service.count();
  } catch (e) {
    console.error("DB connection failed:", e);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900">
          Pet Boss Clinic
        </h1>
        
        <p className="text-gray-600">
          The application scaffold is successfully deployed and running!
        </p>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">System Status</h2>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Database Connection</span>
            <span className="flex items-center text-emerald-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
              {serviceCount} Services Found
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
