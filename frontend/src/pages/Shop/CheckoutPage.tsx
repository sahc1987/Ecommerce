import { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Package, Lock, MapPin, CheckCircle2, Loader2, X } from "lucide-react";
import { RootState } from "../../store";
import { clearCart } from "../../store/slices/cartSlice";
import api from "../../api";

interface Address {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country_code?: string;
  };
}

const SUPPORTED_COUNTRIES = new Set(["US", "CA", "GB", "AU", "DE", "FR", "MX", "BR"]);

export default function CheckoutPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items } = useSelector((s: RootState) => s.cart);
  const { user } = useSelector((s: RootState) => s.auth);

  const [loading, setLoading] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [address, setAddress] = useState<Address>({
    name: user?.name || "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
    country: "US",
  });

  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [addressVerified, setAddressVerified] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get("/setup/status").then((res) => {
      const s = res.data.store;
      if (s?.tax_enabled) {
        setTaxEnabled(true);
        setTaxRate(Number.parseFloat(s.tax_rate) || 0);
      }
    }).catch(() => {});
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const subtotal = items.reduce((sum, i) => sum + i.effective_price * i.quantity, 0);
  const tax = taxEnabled && taxRate > 0 ? Number.parseFloat((subtotal * taxRate / 100).toFixed(2)) : 0;
  const total = subtotal + tax;

  const handleLine1Change = (value: string) => {
    setAddress((prev) => ({ ...prev, line1: value }));
    setAddressVerified(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 5) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&addressdetails=1&limit=6`,
          { headers: { "Accept-Language": "en" } },
        );
        const data: NominatimResult[] = await res.json();
        setSuggestions(data);
        setSuggestionsOpen(data.length > 0);
      } catch {
        // network error — skip suggestions silently
      } finally {
        setLoadingSuggestions(false);
      }
    }, 450);
  };

  const selectSuggestion = (result: NominatimResult) => {
    const a = result.address;
    const line1 =
      [a.house_number, a.road].filter(Boolean).join(" ") ||
      result.display_name.split(",")[0].trim();
    const city = a.city || a.town || a.village || a.county || "";
    const countryCode = (a.country_code || "US").toUpperCase();

    setAddress((prev) => ({
      ...prev,
      line1,
      city,
      state: a.state || "",
      zip: a.postcode || "",
      country: SUPPORTED_COUNTRIES.has(countryCode) ? countryCode : prev.country,
    }));
    setAddressVerified(true);
    setSuggestionsOpen(false);
    setSuggestions([]);
  };

  const clearLine1 = () => {
    setAddress((prev) => ({ ...prev, line1: "" }));
    setAddressVerified(false);
    setSuggestions([]);
    setSuggestionsOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/payments/place-order", {
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        shipping_address: address,
        shipping: 0,
      });
      dispatch(clearCart());
      navigate(`/order-success?order=${res.data.order_id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  const field = (
    label: string,
    key: keyof Address,
    props?: React.InputHTMLAttributes<HTMLInputElement>,
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        className="input"
        value={address[key]}
        onChange={(e) => setAddress((prev) => ({ ...prev, [key]: e.target.value }))}
        {...props}
      />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>
      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900">Shipping Address</h2>

              {field("Full Name", "name", { required: true, placeholder: "John Doe" })}

              {/* Address Line 1 with autocomplete */}
              <div className="relative" ref={suggestionsRef}>
                <label htmlFor="line1" className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 1
                </label>
                <div className="relative">
                  <input
                    id="line1"
                    className="input pr-20"
                    value={address.line1}
                    onChange={(e) => handleLine1Change(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
                    required
                    placeholder="123 Main St"
                    autoComplete="off"
                  />
                  <div className="absolute inset-y-0 right-2 flex items-center gap-1.5 pointer-events-none">
                    {loadingSuggestions && (
                      <Loader2 size={15} className="text-gray-400 animate-spin pointer-events-none" />
                    )}
                    {addressVerified && !loadingSuggestions && (
                      <CheckCircle2 size={16} className="text-emerald-500 pointer-events-none" />
                    )}
                    {address.line1 && !loadingSuggestions && (
                      <button
                        type="button"
                        onClick={clearLine1}
                        className="pointer-events-auto text-gray-400 hover:text-gray-600 p-0.5"
                        tabIndex={-1}
                        aria-label="Clear address"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Suggestions dropdown */}
                {suggestionsOpen && suggestions.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                      Suggestions
                    </p>
                    <ul>
                      {suggestions.map((s) => {
                        const a = s.address;
                        const line1Part =
                          [a.house_number, a.road].filter(Boolean).join(" ") ||
                          s.display_name.split(",")[0].trim();
                        const rest = s.display_name
                          .replace(line1Part, "")
                          .replace(/^,\s*/, "");
                        return (
                          <li key={s.place_id}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectSuggestion(s)}
                              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 transition-colors flex items-start gap-2.5 border-b border-gray-50 last:border-0"
                            >
                              <MapPin size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-gray-800 truncate">
                                  {line1Part}
                                </span>
                                <span className="block text-xs text-gray-500 truncate">{rest}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {addressVerified && (
                  <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
                    <CheckCircle2 size={11} />
                    Address verified
                  </p>
                )}
              </div>

              {field("Address Line 2", "line2", { placeholder: "Apt, Suite, etc. (optional)" })}

              <div className="grid grid-cols-2 gap-4">
                {field("City", "city", { required: true })}
                {field("State / Province", "state", { required: true })}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {field("ZIP / Postal Code", "zip", { required: true })}
                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <select
                    id="country"
                    className="input"
                    value={address.country}
                    onChange={(e) => setAddress((prev) => ({ ...prev, country: e.target.value }))}
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GB">United Kingdom</option>
                    <option value="AU">Australia</option>
                    <option value="DE">Germany</option>
                    <option value="FR">France</option>
                    <option value="MX">Mexico</option>
                    <option value="BR">Brazil</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900">Payment Method</h2>
              <div className="flex items-center gap-3 p-3.5 border border-indigo-200 rounded-lg bg-indigo-50">
                <div className="w-4 h-4 rounded-full border-2 border-indigo-600 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Cash on Delivery</p>
                  <p className="text-xs text-gray-500 mt-0.5">Pay when your order arrives</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="card sticky top-24">
              <h2 className="font-bold text-gray-900 text-lg mb-4">Order Summary</h2>
              <div className="space-y-2 mb-4">
                {items.map((item) => (
                  <div key={item.product_id} className="flex gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={16} className="m-auto text-gray-300 mt-2.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      ${(item.effective_price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span>Free</span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Tax ({taxRate}%)</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base text-gray-900 border-t border-gray-200 pt-2 mt-2">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
              <button
                type="submit"
                className="btn-primary w-full mt-5 flex items-center justify-center gap-2"
                disabled={loading}
              >
                <Lock size={14} />
                {loading ? "Processing..." : `Place Order — $${total.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
