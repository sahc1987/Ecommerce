import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Package, Lock } from "lucide-react";
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

  useEffect(() => {
    api.get("/setup/status").then((res) => {
      const s = res.data.store;
      if (s?.tax_enabled) {
        setTaxEnabled(true);
        setTaxRate(Number.parseFloat(s.tax_rate) || 0);
      }
    }).catch(() => {});
  }, []);

  const subtotal = items.reduce(
    (sum, i) => sum + i.effective_price * i.quantity,
    0,
  );
  const tax = taxEnabled && taxRate > 0 ? Number.parseFloat((subtotal * taxRate / 100).toFixed(2)) : 0;
  const total = subtotal + tax;


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/payments/place-order", {
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
        })),
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
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        className="input"
        value={address[key]}
        onChange={(e) => setAddress({ ...address, [key]: e.target.value })}
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
              {field("Full Name", "name", {
                required: true,
                placeholder: "John Doe",
              })}
              {field("Address Line 1", "line1", {
                required: true,
                placeholder: "123 Main St",
              })}
              {field("Address Line 2", "line2", {
                placeholder: "Apt, Suite, etc. (optional)",
              })}
              <div className="grid grid-cols-2 gap-4">
                {field("City", "city", { required: true })}
                {field("State / Province", "state", { required: true })}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {field("ZIP / Postal Code", "zip", { required: true })}
                <div>
                  <label
                    htmlFor="country"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Country
                  </label>
                  <select
                    id="country"
                    className="input"
                    value={address.country}
                    onChange={(e) =>
                      setAddress({ ...address, country: e.target.value })
                    }
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
              <div className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg bg-gray-50">
                <input
                  type="radio"
                  id="cod"
                  name="payment"
                  defaultChecked
                  readOnly
                  className="text-blue-600"
                />
                <label
                  htmlFor="cod"
                  className="text-sm text-gray-700 font-medium"
                >
                  Cash on Delivery
                </label>
              </div>
            </div>
          </div>

          <div>
            <div className="card sticky top-24">
              <h2 className="font-bold text-gray-900 text-lg mb-4">
                Order Summary
              </h2>
              <div className="space-y-2 mb-4">
                {items.map((item) => (
                  <div key={item.product_id} className="flex gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package
                          size={16}
                          className="m-auto text-gray-300 mt-2.5"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Qty: {item.quantity}
                      </p>
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
                {loading
                  ? "Processing..."
                  : `Place Order — $${total.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
