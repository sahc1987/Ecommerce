import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Store, ArrowRight, Check } from "lucide-react";
import api from "../../api";

interface Props {
  onComplete: () => void;
}

export default function SetupWizard({ onComplete }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    currency: "USD",
    email: "",
    phone: "",
    address: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/setup/complete", form);
      onComplete();
      toast.success("Store configured successfully!");
      navigate("/admin");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "BRL", "MXN"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="flex items-center justify-center mb-8 gap-3">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                  step > s
                    ? "bg-blue-600 text-white"
                    : step === s
                      ? "bg-blue-600 text-white ring-4 ring-blue-200"
                      : "bg-white text-gray-400 border-2 border-gray-200"
                }`}
              >
                {step > s ? <Check size={16} /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-16 h-0.5 mx-1 ${step > s ? "bg-blue-600" : "bg-gray-200"}`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Store className="text-blue-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {step === 1 && "Welcome! Set up your store"}
                {step === 2 && "Contact & Location"}
                {step === 3 && "Review & Launch"}
              </h1>
              <p className="text-gray-500 text-sm">
                {step === 1 && "Tell us about your business"}
                {step === 2 && "Where can customers reach you?"}
                {step === 3 && "Everything looks good?"}
              </p>
            </div>
          </div>

          <form
            onSubmit={
              step === 3
                ? handleSubmit
                : (e) => {
                    e.preventDefault();
                    setStep(step + 1);
                  }
            }
          >
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Store Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="input text-base"
                    placeholder="My Awesome Store"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    className="input resize-none h-24"
                    placeholder="What do you sell? Tell your customers..."
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <select
                    className="input"
                    value={form.currency}
                    onChange={(e) =>
                      setForm({ ...form, currency: e.target.value })
                    }
                  >
                    {currencies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    className="input"
                    placeholder="store@example.com"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="+1 (555) 000-0000"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <textarea
                    className="input resize-none h-24"
                    placeholder="123 Main St, City, State, Country"
                    value={form.address}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-5 space-y-3">
                  {[
                    { label: "Store Name", value: form.name },
                    { label: "Description", value: form.description || "—" },
                    { label: "Currency", value: form.currency },
                    { label: "Email", value: form.email || "—" },
                    { label: "Phone", value: form.phone || "—" },
                    { label: "Address", value: form.address || "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-4">
                      <span className="text-sm font-medium text-gray-500 w-32 flex-shrink-0">
                        {label}
                      </span>
                      <span className="text-sm text-gray-900">{value}</span>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-500">
                  You can update these settings anytime from the admin panel.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between mt-8">
              {step > 1 ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </button>
              ) : (
                <div />
              )}
              <button
                type="submit"
                className="btn-primary flex items-center gap-2"
                disabled={loading}
              >
                {step === 3
                  ? loading
                    ? "Launching..."
                    : "Launch Store"
                  : "Continue"}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
