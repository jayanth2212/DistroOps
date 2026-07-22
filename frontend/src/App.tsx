import { useEffect, useMemo, useState, type FormEvent } from "react";

// --- Types & Interfaces ---

export type Role = "ADMIN" | "SALES" | "WAREHOUSE" | "ACCOUNTS";
export type CustomerType = "RETAIL" | "WHOLESALE" | "DISTRIBUTOR";
export type CustomerStatus = "LEAD" | "ACTIVE" | "INACTIVE";
export type MovementType = "IN" | "OUT";
export type ChallanStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt?: string;
}

export interface FollowUp {
  id: string;
  customerId: string;
  note: string;
  followUpDate?: string;
  createdById: string;
  createdBy: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  businessName?: string;
  gstNumber?: string;
  customerType: CustomerType;
  address?: string;
  status: CustomerStatus;
  followUpDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  followUps?: FollowUp[];
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category?: string;
  unitPrice: number;
  currentStock: number;
  minStockAlert: number;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  quantityChanged: number;
  movementType: MovementType;
  reason: string;
  createdById: string;
  createdBy: string;
  timestamp: string;
}

export interface ChallanItem {
  id: string;
  productId: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
}

export interface Challan {
  id: string;
  challanNumber: string;
  customerId: string;
  totalQuantity: number;
  subtotal: number;
  status: ChallanStatus;
  createdById: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: ChallanItem[];
  customer?: Customer;
}

type Tab = "home" | "customers" | "products" | "challans" | "roles" | "users";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const demoAccounts = [
  { label: "Admin", email: "admin@distroops.com", password: "admin123", role: "ADMIN" as Role, desc: "Full CRUD & Account Provisioning" },
  { label: "Sales", email: "sales@distroops.com", password: "sales123", role: "SALES" as Role, desc: "CRM, Follow-ups, Draft Sales Challans" },
  { label: "Warehouse", email: "warehouse@distroops.com", password: "warehouse123", role: "WAREHOUSE" as Role, desc: "Products, Racks, Manual Stock Adjustments" },
  { label: "Accounts", email: "accounts@distroops.com", password: "accounts123", role: "ACCOUNTS" as Role, desc: "Order Fulfillment, Confirmations, Billing" },
];

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("distroops_token"));
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("distroops_user");
    return raw ? JSON.parse(raw) : null;
  });

  const [landingMode, setLandingMode] = useState<boolean>(!token);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);

  // Search & Filters
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerStatusFilter, setCustomerStatusFilter] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [challanStatusFilter, setChallanStatusFilter] = useState("");

  // Modals & Details
  const [activeCustomerDetail, setActiveCustomerDetail] = useState<Customer | null>(null);
  const [activeProductMovements, setActiveProductMovements] = useState<{ product: Product; movements: StockMovement[] } | null>(null);
  const [activeChallanInvoice, setActiveChallanInvoice] = useState<Challan | null>(null);

  // User Account Form Modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "SALES" as Role,
  });

  // Customer Form
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    mobile: "",
    email: "",
    businessName: "",
    gstNumber: "",
    customerType: "WHOLESALE" as CustomerType,
    address: "",
    status: "LEAD" as CustomerStatus,
    followUpDate: "",
    notes: "",
  });

  // Product Form
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    sku: "",
    category: "General",
    unitPrice: 0,
    currentStock: 0,
    minStockAlert: 10,
    location: "",
  });

  // Challan Form
  const [showChallanModal, setShowChallanModal] = useState(false);
  const [editingChallanId, setEditingChallanId] = useState<string | null>(null);
  const [challanForm, setChallanForm] = useState({
    customerId: "",
    items: [{ productId: "", quantity: 1 }],
  });

  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpDateInput, setFollowUpDateInput] = useState("");

  const [manualStockForm, setManualStockForm] = useState({
    quantityChanged: 10,
    movementType: "IN" as MovementType,
    reason: "Stock intake shipment",
  });

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4500);
  };

  const fetchData = async () => {
    if (!token) return;
    try {
      setError(null);
      const [cRes, pRes, chRes] = await Promise.all([
        fetch(`${API_BASE_URL}/customers`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/products`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/challans`, { headers: authHeaders }),
      ]);

      const cData = await cRes.json();
      const pData = await pRes.json();
      const chData = await chRes.json();

      if (cData.success) setCustomers(cData.data);
      if (pData.success) setProducts(pData.data);
      if (chData.success) setChallans(chData.data);

      if (currentUser?.role === "ADMIN") {
        fetchUsers();
      }
    } catch {
      setError("Failed to connect to backend server. Ensure backend is running on port 4000.");
    }
  };

  const fetchUsers = async () => {
    if (!token || currentUser?.role !== "ADMIN") return;
    try {
      const res = await fetch(`${API_BASE_URL}/users`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setUsersList(data.data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const canAccess = (allowedRoles: Role[]) => {
    return currentUser && allowedRoles.includes(currentUser.role);
  };

  // Auth Functions
  const handleLogin = async (email: string, pass: string) => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "Login failed");
        return;
      }
      setToken(data.data.token);
      setCurrentUser(data.data.user);
      localStorage.setItem("distroops_token", data.data.token);
      localStorage.setItem("distroops_user", JSON.stringify(data.data.user));
      setLandingMode(false);
      flashSuccess(`Authenticated as ${data.data.user.name} (${data.data.user.role})`);
    } catch {
      setError("Unable to reach backend API server");
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem("distroops_token");
    localStorage.removeItem("distroops_user");
    setLandingMode(true);
  };

  // User Account Creation (Admin Only)
  const handleCreateUserAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!canAccess(["ADMIN"])) {
      setError("Permission Denied: Only Admin can create new team accounts.");
      return;
    }
    try {
      setError(null);
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(userForm),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "Failed to create user account");
        return;
      }
      setShowUserModal(false);
      flashSuccess(`Account created for ${data.data.name} (${data.data.role})! They can now sign in with email '${data.data.email}'.`);
      setUserForm({ name: "", email: "", password: "", role: "SALES" });
      fetchUsers();
    } catch {
      setError("Error creating user account");
    }
  };

  // CSV Export Helpers
  const exportCustomersCSV = () => {
    if (customers.length === 0) return;
    const headers = ["Name", "Mobile", "Email", "Business Name", "GST Number", "Type", "Status", "Address"];
    const rows = customers.map((c) => [
      `"${c.name}"`,
      `"${c.mobile}"`,
      `"${c.email || ""}"`,
      `"${c.businessName || ""}"`,
      `"${c.gstNumber || ""}"`,
      `"${c.customerType}"`,
      `"${c.status}"`,
      `"${(c.address || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `distroops-customers-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    flashSuccess("Exported Customer CRM dataset to CSV!");
  };

  const exportChallansCSV = () => {
    if (challans.length === 0) return;
    const headers = ["Challan Number", "Customer Name", "Items Count", "Total Pcs", "Subtotal (INR)", "Status", "Date"];
    const rows = challans.map((ch) => {
      const custName = customers.find((c) => c.id === ch.customerId)?.name || "Unknown Customer";
      return [
        `"${ch.challanNumber}"`,
        `"${custName}"`,
        ch.items.length,
        ch.totalQuantity,
        ch.subtotal.toFixed(2),
        `"${ch.status}"`,
        `"${new Date(ch.createdAt).toLocaleDateString("en-IN")}"`,
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `distroops-sales-report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    flashSuccess("Exported Sales Challans report to CSV!");
  };

  // Customer Actions
  const openCustomerModal = (customer?: Customer) => {
    if (!canAccess(["ADMIN", "SALES"])) {
      setError("Permission Denied: Only Admin and Sales users can add or edit customers.");
      return;
    }
    if (customer) {
      setEditingCustomer(customer);
      setCustomerForm({
        name: customer.name,
        mobile: customer.mobile,
        email: customer.email || "",
        businessName: customer.businessName || "",
        gstNumber: customer.gstNumber || "",
        customerType: customer.customerType,
        address: customer.address || "",
        status: customer.status,
        followUpDate: customer.followUpDate ? customer.followUpDate.slice(0, 10) : "",
        notes: customer.notes || "",
      });
    } else {
      setEditingCustomer(null);
      setCustomerForm({
        name: "",
        mobile: "",
        email: "",
        businessName: "",
        gstNumber: "",
        customerType: "WHOLESALE",
        address: "",
        status: "LEAD",
        followUpDate: "",
        notes: "",
      });
    }
    setShowCustomerModal(true);
  };

  const handleSaveCustomer = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const url = editingCustomer ? `${API_BASE_URL}/customers/${editingCustomer.id}` : `${API_BASE_URL}/customers`;
      const method = editingCustomer ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(customerForm),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "Failed to save customer");
        return;
      }
      setShowCustomerModal(false);
      flashSuccess(editingCustomer ? "Customer updated successfully!" : "Customer added successfully!");
      fetchData();
    } catch {
      setError("Error saving customer data");
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    if (!canAccess(["ADMIN", "SALES"])) {
      setError("Permission Denied: Only Admin and Sales staff can delete customers.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete customer record '${customer.name}'?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/customers/${customer.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "Failed to delete customer");
        return;
      }
      flashSuccess(`Customer '${customer.name}' deleted successfully.`);
      fetchData();
    } catch {
      setError("Error deleting customer");
    }
  };

  const viewCustomerDetail = async (customer: Customer) => {
    try {
      const res = await fetch(`${API_BASE_URL}/customers/${customer.id}`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setActiveCustomerDetail(data.data);
      }
    } catch {
      setActiveCustomerDetail(customer);
    }
  };

  const handleAddFollowUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!canAccess(["ADMIN", "SALES"])) {
      setError("Permission Denied: Only Admin and Sales users can log follow-up notes.");
      return;
    }
    if (!activeCustomerDetail || !followUpNote.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/customers/${activeCustomerDetail.id}/followups`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          note: followUpNote,
          followUpDate: followUpDateInput || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFollowUpNote("");
        setFollowUpDateInput("");
        flashSuccess("Follow-up note recorded!");
        viewCustomerDetail(activeCustomerDetail);
        fetchData();
      } else {
        setError(data.error?.message || "Failed to add follow-up");
      }
    } catch {
      setError("Error adding follow-up note");
    }
  };

  // Product Actions
  const openProductModal = (product?: Product) => {
    if (!canAccess(["ADMIN", "WAREHOUSE"])) {
      setError("Permission Denied: Only Admin and Warehouse users can create or edit products.");
      return;
    }
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        sku: product.sku,
        category: product.category || "General",
        unitPrice: product.unitPrice,
        currentStock: product.currentStock,
        minStockAlert: product.minStockAlert,
        location: product.location || "",
      });
    } else {
      setEditingProduct(null);
      setProductForm({
        name: "",
        sku: "",
        category: "General",
        unitPrice: 0,
        currentStock: 0,
        minStockAlert: 10,
        location: "",
      });
    }
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const url = editingProduct ? `${API_BASE_URL}/products/${editingProduct.id}` : `${API_BASE_URL}/products`;
      const method = editingProduct ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(productForm),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "Failed to save product");
        return;
      }
      setShowProductModal(false);
      flashSuccess(editingProduct ? "Product updated successfully!" : "Product created successfully!");
      fetchData();
    } catch {
      setError("Error saving product data");
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!canAccess(["ADMIN", "WAREHOUSE"])) {
      setError("Permission Denied: Only Admin and Warehouse staff can delete products.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete product '${product.name}' (${product.sku})?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/products/${product.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "Failed to delete product");
        return;
      }
      flashSuccess(`Product '${product.name}' deleted.`);
      fetchData();
    } catch {
      setError("Error deleting product");
    }
  };

  const viewStockMovements = async (product: Product) => {
    try {
      const res = await fetch(`${API_BASE_URL}/products/${product.id}/stock-movements`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setActiveProductMovements({ product, movements: data.data });
      }
    } catch {
      setError("Failed to fetch stock movements");
    }
  };

  const handleManualStockAdjustment = async (e: FormEvent) => {
    e.preventDefault();
    if (!canAccess(["ADMIN", "WAREHOUSE"])) {
      setError("Permission Denied: Only Admin and Warehouse staff can execute manual stock movements.");
      return;
    }
    if (!activeProductMovements) return;

    try {
      const res = await fetch(`${API_BASE_URL}/products/${activeProductMovements.product.id}/stock-movements`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(manualStockForm),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "Stock adjustment failed");
        return;
      }
      flashSuccess("Stock movement recorded and inventory updated!");
      viewStockMovements(activeProductMovements.product);
      fetchData();
    } catch {
      setError("Error applying stock movement");
    }
  };

  // Challan Actions
  const openChallanModal = (challan?: Challan) => {
    if (!canAccess(["ADMIN", "SALES"])) {
      setError("Permission Denied: Only Admin and Sales staff can create or edit draft sales challans.");
      return;
    }
    if (challan) {
      setEditingChallanId(challan.id);
      setChallanForm({
        customerId: challan.customerId,
        items: challan.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
    } else {
      setEditingChallanId(null);
      setChallanForm({
        customerId: customers[0]?.id || "",
        items: [{ productId: products[0]?.id || "", quantity: 1 }],
      });
    }
    setShowChallanModal(true);
  };

  const addChallanItemRow = () => {
    setChallanForm((prev) => ({
      ...prev,
      items: [...prev.items, { productId: products[0]?.id || "", quantity: 1 }],
    }));
  };

  const removeChallanItemRow = (index: number) => {
    setChallanForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateChallanItemRow = (index: number, field: "productId" | "quantity", value: string | number) => {
    setChallanForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const handleSaveChallan = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const url = editingChallanId ? `${API_BASE_URL}/challans/${editingChallanId}` : `${API_BASE_URL}/challans`;
      const method = editingChallanId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(challanForm),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "Failed to save sales challan");
        return;
      }
      setShowChallanModal(false);
      flashSuccess(editingChallanId ? "Draft challan updated!" : "Draft sales challan created!");
      fetchData();
    } catch {
      setError("Error saving sales challan");
    }
  };

  const handleConfirmChallan = async (challanId: string) => {
    if (!canAccess(["ADMIN", "SALES", "ACCOUNTS"])) {
      setError("Permission Denied: Only Admin, Sales, and Accounts roles can confirm sales orders.");
      return;
    }
    try {
      setError(null);
      const res = await fetch(`${API_BASE_URL}/challans/${challanId}/confirm`, {
        method: "POST",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!data.success) {
        let msg = data.error?.message || "Failed to confirm sales challan";
        if (data.error?.details && Array.isArray(data.error.details)) {
          const detailStr = data.error.details
            .map((d: any) => `${d.productName} (Avail: ${d.available}, Requested: ${d.requested})`)
            .join("; ");
          msg += ` -> Shortages: ${detailStr}`;
        }
        setError(msg);
        return;
      }
      flashSuccess(`Sales Challan confirmed! Stock deducted and OUT audit movement logged.`);
      if (activeChallanInvoice && activeChallanInvoice.id === challanId) {
        setActiveChallanInvoice(data.data);
      }
      fetchData();
    } catch {
      setError("Error confirming sales challan");
    }
  };

  const handleCancelChallan = async (challanId: string) => {
    if (!canAccess(["ADMIN", "SALES", "ACCOUNTS"])) {
      setError("Permission Denied: Only Admin, Sales, and Accounts roles can cancel orders.");
      return;
    }
    try {
      setError(null);
      const res = await fetch(`${API_BASE_URL}/challans/${challanId}/cancel`, {
        method: "POST",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "Failed to cancel sales challan");
        return;
      }
      flashSuccess("Challan cancelled. Any confirmed inventory stock has been restored.");
      if (activeChallanInvoice && activeChallanInvoice.id === challanId) {
        setActiveChallanInvoice(data.data);
      }
      fetchData();
    } catch {
      setError("Error cancelling sales challan");
    }
  };

  // Filtered Data
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.mobile.includes(customerSearch) ||
        (c.email && c.email.toLowerCase().includes(customerSearch.toLowerCase()));
      const matchesStatus = !customerStatusFilter || c.status === customerStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [customers, customerSearch, customerStatusFilter]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase());
      const matchesLowStock = !onlyLowStock || p.currentStock <= p.minStockAlert;
      return matchesSearch && matchesLowStock;
    });
  }, [products, productSearch, onlyLowStock]);

  const filteredChallans = useMemo(() => {
    return challans.filter((ch) => !challanStatusFilter || ch.status === challanStatusFilter);
  }, [challans, challanStatusFilter]);

  const lowStockAlerts = useMemo(() => products.filter((p) => p.currentStock <= p.minStockAlert), [products]);

  const stats = useMemo(() => {
    const totalCust = customers.length;
    const totalProd = products.length;
    const lowStockCount = lowStockAlerts.length;
    const draftCount = challans.filter((c) => c.status === "DRAFT").length;
    const confirmedCount = challans.filter((c) => c.status === "CONFIRMED").length;
    const revenue = challans
      .filter((c) => c.status === "CONFIRMED")
      .reduce((sum, c) => sum + (c.subtotal || 0), 0);

    return { totalCust, totalProd, lowStockCount, draftCount, confirmedCount, revenue };
  }, [customers, products, lowStockAlerts, challans]);

  // PUBLIC LANDING PAGE
  if (landingMode) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand-group">
            <div className="brand-mark">DO</div>
            <div>
              <h1>DistroOps Platform</h1>
              <div className="brand-subtitle">Enterprise ERP & CRM Operations Engine</div>
            </div>
          </div>

          <div className="header-actions">
            {token && currentUser ? (
              <button onClick={() => setLandingMode(false)}>Return to Dashboard ({currentUser.name})</button>
            ) : (
              <a href="#login-portal" style={{ textDecoration: "none" }}>
                <button>Sign In to Portal</button>
              </a>
            )}
          </div>
        </header>

        <section className="card hero-card" style={{ padding: "40px 32px", background: "linear-gradient(135deg, #1B2430 0%, #2A3441 100%)", color: "white", marginBottom: 32 }}>
          <div style={{ maxWidth: 760 }}>
            <span className="pill" style={{ background: "rgba(241, 217, 174, 0.2)", color: "#F1D9AE", fontWeight: 700, marginBottom: 12 }}>DistroOps ERP/CRM Solution</span>
            <h1 style={{ fontSize: 36, color: "white", lineHeight: 1.25, marginTop: 8 }}>
              Streamlined B2B Wholesale Distribution, CRM & Inventory Audit Portal
            </h1>
            <p style={{ color: "#9AA3AF", fontSize: 16, marginTop: 14, lineHeight: 1.6 }}>
              A high-performance operations platform built for distribution teams. Coordinate customer leads, track GST records, manage warehouse rack inventory, auto-deduct stock on sales challan confirmation, and enforce strict role-based security.
            </p>

            <div style={{ display: "flex", gap: 14, marginTop: 24, flexWrap: "wrap" }}>
              <a href="#login-portal" style={{ textDecoration: "none" }}>
                <button style={{ padding: "12px 24px", fontSize: 15 }}>Launch Operations Portal →</button>
              </a>
              <a href="#roles-section" style={{ textDecoration: "none" }}>
                <button className="secondary" style={{ padding: "12px 20px", fontSize: 15, background: "transparent", color: "white", borderColor: "rgba(255,255,255,0.3)" }}>
                  Explore RBAC Matrix
                </button>
              </a>
            </div>
          </div>
        </section>

        <section className="grid" style={{ marginBottom: 32 }}>
          <div className="card">
            <div style={{ fontSize: 28, marginBottom: 8 }}>👥</div>
            <h3 style={{ fontSize: 18 }}>Customer CRM Module</h3>
            <p style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.5, marginTop: 6 }}>
              Track retail, wholesale, and distributor accounts. Log GST numbers, follow-up dates, and maintain chronological CRM activity timelines.
            </p>
          </div>

          <div className="card">
            <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
            <h3 style={{ fontSize: 18 }}>Product & Stock Management</h3>
            <p style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.5, marginTop: 6 }}>
              Maintain catalog items with SKU codes, unit prices, location racks, and minimum alert thresholds. Complete IN/OUT movement audit history.
            </p>
          </div>

          <div className="card">
            <div style={{ fontSize: 28, marginBottom: 8 }}>📜</div>
            <h3 style={{ fontSize: 18 }}>Sales Challans & Order Fulfillment</h3>
            <p style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.5, marginTop: 6 }}>
              Generate draft challans, freeze product item snapshots at sales time, check stock availability, and atomically deduct inventory upon confirmation.
            </p>
          </div>
        </section>

        <section id="roles-section" className="card" style={{ marginBottom: 32 }}>
          <div className="section-heading" style={{ marginBottom: 20 }}>
            <div>
              <h2>Role-Based Access Control (RBAC) Architecture</h2>
              <div className="module-notice">Every feature in DistroOps is protected by strict role permissions at API and UI levels.</div>
            </div>
          </div>

          <div className="role-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <div className="demo-chip">
              <span className="pill" style={{ background: "#DCEAE1", color: "#3F7D58", marginBottom: 8 }}>ADMIN ROLE</span>
              <strong>System Administrator</strong>
              <p style={{ fontSize: 13, color: "var(--slate)", margin: "8px 0 0" }}>
                Full system control. Provision team accounts, create and manage customers, products, stock, and sales challans.
              </p>
            </div>

            <div className="demo-chip">
              <span className="pill" style={{ background: "#F1D9AE", color: "#C98A2C", marginBottom: 8 }}>SALES ROLE</span>
              <strong>Sales Team Representative</strong>
              <p style={{ fontSize: 13, color: "var(--slate)", margin: "8px 0 0" }}>
                Manage customer leads, schedule follow-ups, and build draft sales challans. Read-only access to product inventory.
              </p>
            </div>

            <div className="demo-chip">
              <span className="pill" style={{ background: "#DEE6EE", color: "#43607C", marginBottom: 8 }}>WAREHOUSE ROLE</span>
              <strong>Warehouse Manager</strong>
              <p style={{ fontSize: 13, color: "var(--slate)", margin: "8px 0 0" }}>
                Manage catalog items, monitor low stock alerts, assign rack locations, and execute manual IN/OUT stock adjustments.
              </p>
            </div>

            <div className="demo-chip">
              <span className="pill" style={{ background: "#F4DEDB", color: "#B5473F", marginBottom: 8 }}>ACCOUNTS ROLE</span>
              <strong>Accounts & Finance</strong>
              <p style={{ fontSize: 13, color: "var(--slate)", margin: "8px 0 0" }}>
                Review sales orders, confirm challans for delivery dispatch, process order cancellations, and generate printable GST invoices.
              </p>
            </div>
          </div>
        </section>

        <section id="login-portal" className="card login-card" style={{ maxWidth: 540, margin: "auto", padding: 32 }}>
          <div className="brand-group" style={{ marginBottom: 20, justifyContent: "center" }}>
            <div className="brand-mark">DO</div>
            <div>
              <h2 style={{ fontSize: 22, margin: 0 }}>Portal Authentication</h2>
              <div className="brand-subtitle">Select a demo role or enter account credentials</div>
            </div>
          </div>

          {error && (
            <div style={{ background: "#F4DEDB", color: "#B5473F", padding: 10, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              handleLogin(form.emailInput.value, form.passwordInput.value);
            }}
            className="form-stack"
          >
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Work Email</label>
              <input name="emailInput" type="email" defaultValue="admin@distroops.com" required />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Password</label>
              <input name="passwordInput" type="password" defaultValue="admin123" required />
            </div>
            <button type="submit" style={{ width: "100%", marginTop: 8 }}>Sign In to DistroOps Portal</button>
          </form>

          <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--slate)", marginBottom: 10, textTransform: "uppercase" }}>
              1-Click Role Login Demo:
            </div>
            <div className="role-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {demoAccounts.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  className="secondary"
                  style={{ padding: "10px", fontSize: 12, textAlign: "left" }}
                  onClick={() => handleLogin(acc.email, acc.password)}
                >
                  <strong style={{ display: "block" }}>{acc.label} Role</strong>
                  <span style={{ fontSize: 11, color: "var(--slate)", display: "block" }}>{acc.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <footer
          style={{
            marginTop: 40,
            marginBottom: 24,
            padding: "20px 24px",
            borderTop: "1px solid var(--border)",
            textAlign: "center",
            background: "var(--panel)",
            borderRadius: "var(--radius)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
            Developed and Designed by Jayanth - 5C2
          </div>
          <div style={{ fontSize: 13, color: "var(--slate)" }}>
            Organization: <strong>GCET</strong>
          </div>
        </footer>
      </div>
    );
  }

  // INTERNAL OPERATIONS APP
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-group">
          <div className="brand-mark">DO</div>
          <div>
            <h1>DistroOps Platform</h1>
            <div className="brand-subtitle">Internal Operations Portal</div>
          </div>
        </div>

        <div className="header-actions">
          <button className="secondary" onClick={() => setLandingMode(true)} style={{ padding: "6px 12px", fontSize: 12 }}>
            🌐 Public Home Page
          </button>
          <span className="context-pill" style={{ background: "#F1D9AE", color: "#C98A2C", fontWeight: 700 }}>
            Role: {currentUser?.role}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{currentUser?.name}</span>
          <button className="secondary" onClick={handleLogout} style={{ padding: "6px 12px", fontSize: 12 }}>
            Sign Out
          </button>
        </div>
      </header>

      {error && (
        <div style={{ background: "#F4DEDB", color: "#B5473F", border: "1px solid #B5473F", padding: 12, borderRadius: 6, marginBottom: 16 }}>
          <strong>Access / Error Notice: </strong> {error}
        </div>
      )}
      {successMsg && (
        <div style={{ background: "#DCEAE1", color: "#3F7D58", border: "1px solid #3F7D58", padding: 12, borderRadius: 6, marginBottom: 16 }}>
          <strong>System Notice: </strong> {successMsg}
        </div>
      )}

      <nav className="tab-row">
        <button className={`tab-button ${activeTab === "home" ? "active" : ""}`} onClick={() => setActiveTab("home")}>
          📊 Home Dashboard
        </button>
        <button className={`tab-button ${activeTab === "customers" ? "active" : ""}`} onClick={() => setActiveTab("customers")}>
          👥 Customer CRM ({customers.length})
        </button>
        <button className={`tab-button ${activeTab === "products" ? "active" : ""}`} onClick={() => setActiveTab("products")}>
          📦 Products & Stock ({products.length})
        </button>
        <button className={`tab-button ${activeTab === "challans" ? "active" : ""}`} onClick={() => setActiveTab("challans")}>
          📜 Sales Challans ({challans.length})
        </button>
        {currentUser?.role === "ADMIN" && (
          <button className={`tab-button ${activeTab === "users" ? "active" : ""}`} onClick={() => { setActiveTab("users"); fetchUsers(); }}>
            🔑 Provision Accounts ({usersList.length})
          </button>
        )}
        <button className={`tab-button ${activeTab === "roles" ? "active" : ""}`} onClick={() => setActiveTab("roles")}>
          🛡️ Role Access Matrix
        </button>
      </nav>

      {/* TAB 1: HOME DASHBOARD */}
      {activeTab === "home" && (
        <div className="stack">
          <div className="stats-grid">
            <div className="stat-card">
              <span>Total Customers</span>
              <strong>{stats.totalCust}</strong>
            </div>
            <div className="stat-card">
              <span>Product Catalog</span>
              <strong>{stats.totalProd}</strong>
            </div>
            <div className="stat-card" style={{ borderColor: stats.lowStockCount > 0 ? "var(--red)" : "var(--border)" }}>
              <span style={{ color: stats.lowStockCount > 0 ? "var(--red)" : "var(--slate)" }}>Low Stock Warnings</span>
              <strong style={{ color: stats.lowStockCount > 0 ? "var(--red)" : "var(--ink)" }}>{stats.lowStockCount}</strong>
            </div>
            <div className="stat-card">
              <span>Orders (Draft / Confirmed)</span>
              <strong>{stats.draftCount} / {stats.confirmedCount}</strong>
            </div>
            <div className="stat-card">
              <span>Confirmed Revenue</span>
              <strong>₹{stats.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>

          <div className="card" style={{ background: "#FAF9F6" }}>
            <div className="section-heading">
              <div>
                <h3 style={{ margin: 0 }}>Role Action Center ({currentUser?.role} Mode)</h3>
                <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 2 }}>
                  Showing action shortcuts available to your role level.
                </div>
              </div>
              <span className="pill" style={{ background: "#1B2430", color: "white" }}>User ID: {currentUser?.id}</span>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
              {canAccess(["ADMIN"]) && (
                <button style={{ background: "var(--amber)", color: "#1B2430", fontWeight: 700 }} onClick={() => { setActiveTab("users"); setShowUserModal(true); }}>
                  🔑 Create New Role Account
                </button>
              )}

              {canAccess(["ADMIN", "SALES"]) ? (
                <button onClick={() => { setActiveTab("customers"); openCustomerModal(); }}>+ Add New Customer</button>
              ) : (
                <button className="secondary" disabled style={{ opacity: 0.6 }}>+ Add Customer (Sales / Admin Only)</button>
              )}

              {canAccess(["ADMIN", "WAREHOUSE"]) ? (
                <button onClick={() => { setActiveTab("products"); openProductModal(); }}>+ Add Product Item</button>
              ) : (
                <button className="secondary" disabled style={{ opacity: 0.6 }}>+ Add Product (Warehouse / Admin Only)</button>
              )}

              {canAccess(["ADMIN", "SALES"]) ? (
                <button onClick={() => { setActiveTab("challans"); openChallanModal(); }}>+ Create Sales Challan</button>
              ) : (
                <button className="secondary" disabled style={{ opacity: 0.6 }}>+ Create Challan (Sales / Admin Only)</button>
              )}

              <button className="secondary" onClick={() => { setActiveTab("products"); setOnlyLowStock(true); }}>
                ⚠️ Inspect Low Stock Alerts ({stats.lowStockCount})
              </button>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="card">
              <div className="section-heading">
                <h3>Low Stock Inventory Warning List</h3>
                <button className="secondary" onClick={() => { setActiveTab("products"); setOnlyLowStock(true); }} style={{ fontSize: 12, padding: "4px 8px" }}>View Catalog</button>
              </div>

              {lowStockAlerts.length === 0 ? (
                <p style={{ color: "var(--slate)", margin: "16px 0 0" }}>All product stocks are well above minimum alert levels!</p>
              ) : (
                <ul className="attention-list" style={{ marginTop: 12 }}>
                  {lowStockAlerts.map((p) => (
                    <li key={p.id} className="list-row">
                      <div>
                        <strong>{p.name}</strong> <span style={{ fontSize: 12, color: "var(--slate)" }}>({p.sku})</span>
                        <div style={{ fontSize: 12, color: "var(--slate)" }}>Rack Location: {p.location || "N/A"}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span className="pill" style={{ background: "#F4DEDB", color: "#B5473F", fontWeight: 700 }}>Current: {p.currentStock}</span>
                        <div style={{ fontSize: 11, color: "var(--slate)", marginTop: 2 }}>Min Alert Qty: {p.minStockAlert}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card">
              <div className="section-heading">
                <h3>Recent Sales Orders</h3>
                <button className="secondary" onClick={() => setActiveTab("challans")} style={{ fontSize: 12, padding: "4px 8px" }}>View All</button>
              </div>
              <div className="list-stack" style={{ marginTop: 12 }}>
                {challans.slice(0, 5).map((ch) => {
                  const custName = customers.find((c) => c.id === ch.customerId)?.name || "Customer";
                  return (
                    <div key={ch.id} className="list-row" style={{ display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <strong><code>{ch.challanNumber}</code></strong> — {custName}
                        <div style={{ fontSize: 12, color: "var(--slate)" }}>{ch.items.length} items | ₹{ch.subtotal.toFixed(2)}</div>
                      </div>
                      <span className="status-pill" style={{
                        background: ch.status === "CONFIRMED" ? "#DCEAE1" : ch.status === "DRAFT" ? "#F1D9AE" : "#F4DEDB",
                        color: ch.status === "CONFIRMED" ? "#3F7D58" : ch.status === "DRAFT" ? "#C98A2C" : "#B5473F"
                      }}>
                        {ch.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOMER CRM */}
      {activeTab === "customers" && (
        <div className="card">
          <div className="section-heading" style={{ marginBottom: 16 }}>
            <div>
              <h3>Customer CRM Management</h3>
              <div className="module-notice" style={{ fontSize: 13 }}>Track leads, active accounts, contact GST info, and follow-up schedules.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="secondary" onClick={exportCustomersCSV}>📥 Export CSV</button>
              {canAccess(["ADMIN", "SALES"]) && (
                <button onClick={() => openCustomerModal()}>+ Add New Customer</button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <input
              placeholder="Search customer name, mobile, email, business..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              style={{ maxWidth: 360 }}
            />
            <select value={customerStatusFilter} onChange={(e) => setCustomerStatusFilter(e.target.value)} style={{ maxWidth: 180 }}>
              <option value="">All Statuses</option>
              <option value="LEAD">LEAD</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Contact Info</th>
                  <th>Type</th>
                  <th>GST Number</th>
                  <th>Status</th>
                  <th>Next Follow-up</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--slate)" }}>No customers found matching search filters.</td></tr>
                ) : (
                  filteredCustomers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                        {c.businessName && <div style={{ fontSize: 12, color: "var(--slate)" }}>{c.businessName}</div>}
                      </td>
                      <td>
                        <div>📞 {c.mobile}</div>
                        {c.email && <div style={{ fontSize: 12, color: "var(--slate)" }}>✉️ {c.email}</div>}
                      </td>
                      <td><span className="pill">{c.customerType}</span></td>
                      <td><code>{c.gstNumber || "N/A"}</code></td>
                      <td>
                        <span className="status-pill" style={{
                          background: c.status === "ACTIVE" ? "#DCEAE1" : c.status === "LEAD" ? "#F1D9AE" : "#DEE6EE",
                          color: c.status === "ACTIVE" ? "#3F7D58" : c.status === "LEAD" ? "#C98A2C" : "#43607C"
                        }}>
                          {c.status}
                        </span>
                      </td>
                      <td>{c.followUpDate ? new Date(c.followUpDate).toLocaleDateString("en-IN") : "None"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => viewCustomerDetail(c)}>Details</button>
                          {canAccess(["ADMIN", "SALES"]) && (
                            <>
                              <button className="secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => openCustomerModal(c)}>Edit</button>
                              <button className="danger" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => handleDeleteCustomer(c)}>Delete</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PRODUCTS & INVENTORY */}
      {activeTab === "products" && (
        <div className="card">
          <div className="section-heading" style={{ marginBottom: 16 }}>
            <div>
              <h3>Product Catalog & Inventory</h3>
              <div className="module-notice" style={{ fontSize: 13 }}>Manage stock levels, SKU identifiers, location racks, and stock audit logs.</div>
            </div>
            {canAccess(["ADMIN", "WAREHOUSE"]) && (
              <button onClick={() => openProductModal()}>+ Add New Product</button>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <input
              placeholder="Search product name, SKU..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              style={{ maxWidth: 360 }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={onlyLowStock}
                onChange={(e) => setOnlyLowStock(e.target.checked)}
                style={{ width: "auto" }}
              />
              Show Low Stock Warnings Only ({lowStockAlerts.length})
            </label>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Product & SKU</th>
                  <th>Category</th>
                  <th>Unit Price</th>
                  <th>Current Stock</th>
                  <th>Min Alert Qty</th>
                  <th>Location</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--slate)" }}>No products found.</td></tr>
                ) : (
                  filteredProducts.map((p) => {
                    const isLow = p.currentStock <= p.minStockAlert;
                    return (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.name}</strong>
                          <div style={{ fontSize: 12, color: "var(--slate)" }}>SKU: <code>{p.sku}</code></div>
                        </td>
                        <td><span className="pill">{p.category || "General"}</span></td>
                        <td><strong>₹{p.unitPrice.toFixed(2)}</strong></td>
                        <td>
                          <span className="pill" style={{
                            background: isLow ? "#F4DEDB" : "#DCEAE1",
                            color: isLow ? "#B5473F" : "#3F7D58",
                            fontWeight: 700
                          }}>
                            {p.currentStock} units {isLow && "⚠️ LOW"}
                          </span>
                        </td>
                        <td>{p.minStockAlert} units</td>
                        <td>{p.location || "Default Rack"}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => viewStockMovements(p)}>Stock Log</button>
                            {canAccess(["ADMIN", "WAREHOUSE"]) && (
                              <>
                                <button className="secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => openProductModal(p)}>Edit</button>
                                <button className="danger" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => handleDeleteProduct(p)}>Delete</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SALES CHALLANS */}
      {activeTab === "challans" && (
        <div className="card">
          <div className="section-heading" style={{ marginBottom: 16 }}>
            <div>
              <h3>Sales Challans & Order Fulfillment</h3>
              <div className="module-notice" style={{ fontSize: 13 }}>Create draft sales challans, validate stock levels, and execute inventory transactions.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="secondary" onClick={exportChallansCSV}>📥 Export Sales CSV</button>
              {canAccess(["ADMIN", "SALES"]) && (
                <button onClick={() => openChallanModal()}>+ Create Sales Challan</button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <select value={challanStatusFilter} onChange={(e) => setChallanStatusFilter(e.target.value)} style={{ maxWidth: 200 }}>
              <option value="">All Challan Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Challan No.</th>
                  <th>Customer</th>
                  <th>Total Items</th>
                  <th>Subtotal</th>
                  <th>Status</th>
                  <th>Created Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredChallans.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--slate)" }}>No challans created yet.</td></tr>
                ) : (
                  filteredChallans.map((ch) => {
                    const customerName = customers.find((c) => c.id === ch.customerId)?.name || "Unknown Customer";
                    return (
                      <tr key={ch.id}>
                        <td><strong><code>{ch.challanNumber}</code></strong></td>
                        <td>{customerName}</td>
                        <td>{ch.items.length} items ({ch.totalQuantity} total pcs)</td>
                        <td><strong>₹{ch.subtotal.toFixed(2)}</strong></td>
                        <td>
                          <span className="status-pill" style={{
                            background: ch.status === "CONFIRMED" ? "#DCEAE1" : ch.status === "DRAFT" ? "#F1D9AE" : "#F4DEDB",
                            color: ch.status === "CONFIRMED" ? "#3F7D58" : ch.status === "DRAFT" ? "#C98A2C" : "#B5473F"
                          }}>
                            {ch.status}
                          </span>
                        </td>
                        <td>{new Date(ch.createdAt).toLocaleDateString("en-IN")}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => setActiveChallanInvoice(ch)}>Invoice</button>
                            {ch.status === "DRAFT" && canAccess(["ADMIN", "SALES"]) && (
                              <button className="secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => openChallanModal(ch)}>Edit</button>
                            )}
                            {ch.status === "DRAFT" && canAccess(["ADMIN", "SALES", "ACCOUNTS"]) && (
                              <button style={{ padding: "4px 8px", fontSize: 12, background: "var(--green)", color: "white" }} onClick={() => handleConfirmChallan(ch.id)}>Confirm Stock</button>
                            )}
                            {ch.status !== "CANCELLED" && canAccess(["ADMIN", "SALES", "ACCOUNTS"]) && (
                              <button className="danger" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => handleCancelChallan(ch.id)}>Cancel</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SYSTEM USER ACCOUNTS PROVISIONING (ADMIN ONLY) */}
      {activeTab === "users" && currentUser?.role === "ADMIN" && (
        <div className="card">
          <div className="section-heading" style={{ marginBottom: 16 }}>
            <div>
              <h3>System Role Accounts Provisioning</h3>
              <div className="module-notice" style={{ fontSize: 13 }}>Create and manage team account credentials for Sales, Warehouse, and Accounts staff.</div>
            </div>
            <button style={{ background: "var(--amber)", color: "#1B2430", fontWeight: 700 }} onClick={() => setShowUserModal(true)}>
              + Create New User Account
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Work Email</th>
                  <th>Assigned Role</th>
                  <th>User ID</th>
                  <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {usersList.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--slate)" }}>Loading system accounts...</td></tr>
                ) : (
                  usersList.map((u) => (
                    <tr key={u.id}>
                      <td><strong>{u.name}</strong></td>
                      <td><code>{u.email}</code></td>
                      <td>
                        <span className="status-pill" style={{
                          background: u.role === "ADMIN" ? "#DCEAE1" : u.role === "SALES" ? "#F1D9AE" : u.role === "WAREHOUSE" ? "#DEE6EE" : "#F4DEDB",
                          color: u.role === "ADMIN" ? "#3F7D58" : u.role === "SALES" ? "#C98A2C" : u.role === "WAREHOUSE" ? "#43607C" : "#B5473F",
                          fontWeight: 700
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td><code>{u.id}</code></td>
                      <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN") : "System Default"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: ROLE ACCESS MATRIX */}
      {activeTab === "roles" && (
        <div className="card">
          <div className="section-heading" style={{ marginBottom: 16 }}>
            <div>
              <h3>Role Access Control (RBAC) System Matrix</h3>
              <div className="module-notice">Comprehensive permission controls configured across all portal operations.</div>
            </div>
            <span className="pill" style={{ background: "#F1D9AE", color: "#C98A2C", fontWeight: 700 }}>Your Active Role: {currentUser?.role}</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Module / Operation</th>
                  <th>Admin</th>
                  <th>Sales</th>
                  <th>Warehouse</th>
                  <th>Accounts</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Provision User Accounts</strong></td>
                  <td>✅ Create Role Accounts</td>
                  <td>🔒 Restricted</td>
                  <td>🔒 Restricted</td>
                  <td>🔒 Restricted</td>
                </tr>
                <tr>
                  <td><strong>Customer Records (CRUD & Delete)</strong></td>
                  <td>✅ Full Access</td>
                  <td>✅ Add / Edit / Delete</td>
                  <td>🔒 Read-Only</td>
                  <td>🔒 Read-Only</td>
                </tr>
                <tr>
                  <td><strong>CRM Follow-up Notes</strong></td>
                  <td>✅ Full Access</td>
                  <td>✅ Add Follow-ups</td>
                  <td>🔒 Read-Only</td>
                  <td>🔒 Read-Only</td>
                </tr>
                <tr>
                  <td><strong>Product Catalog (CRUD & Delete)</strong></td>
                  <td>✅ Full Access</td>
                  <td>🔒 Read-Only</td>
                  <td>✅ Add / Edit / Delete</td>
                  <td>🔒 Read-Only</td>
                </tr>
                <tr>
                  <td><strong>Manual Stock Adjustment (IN/OUT)</strong></td>
                  <td>✅ Full Access</td>
                  <td>🔒 Restricted</td>
                  <td>✅ Manual Adjustments</td>
                  <td>🔒 Restricted</td>
                </tr>
                <tr>
                  <td><strong>Sales Challan Creation (Draft)</strong></td>
                  <td>✅ Full Access</td>
                  <td>✅ Create & Edit Drafts</td>
                  <td>🔒 Read-Only</td>
                  <td>🔒 Read-Only</td>
                </tr>
                <tr>
                  <td><strong>Confirm Order (Stock Deduction)</strong></td>
                  <td>✅ Full Access</td>
                  <td>✅ Confirm Orders</td>
                  <td>🔒 Restricted</td>
                  <td>✅ Confirm Orders</td>
                </tr>
                <tr>
                  <td><strong>Cancel Order (Stock Reversal)</strong></td>
                  <td>✅ Full Access</td>
                  <td>✅ Cancel Orders</td>
                  <td>🔒 Restricted</td>
                  <td>✅ Cancel Orders</td>
                </tr>
                <tr>
                  <td><strong>Export CSV / Print GST Invoices</strong></td>
                  <td>✅ Full Access</td>
                  <td>✅ Export CSV & PDF</td>
                  <td>✅ Export CSV & PDF</td>
                  <td>✅ Export CSV & PDF</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- MODAL 0: USER ACCOUNT PROVISIONING MODAL (ADMIN ONLY) --- */}
      {showUserModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 1000, padding: 16 }}>
          <div className="card" style={{ maxWidth: 480, width: "100%" }}>
            <h3>🔑 Provision New Team Role Account</h3>
            <div style={{ fontSize: 13, color: "var(--slate)", marginBottom: 16 }}>
              Created accounts will immediately be saved to PostgreSQL and can log in with their email & password.
            </div>

            <form onSubmit={handleCreateUserAccount} className="form-stack">
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Full Name *</label>
                <input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} placeholder="e.g. Rahul Sharma" required />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Work Email *</label>
                <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="rahul@distroops.com" required />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Password * (Min 6 characters)</label>
                <input type="password" minLength={6} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="Enter secure password" required />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Assign System Role *</label>
                <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as Role })}>
                  <option value="SALES">SALES — Customer CRM, Follow-ups, Sales Challans</option>
                  <option value="WAREHOUSE">WAREHOUSE — Products Catalog, Rack Placement, Stock Logs</option>
                  <option value="ACCOUNTS">ACCOUNTS — Order Confirmation, Order Cancellation, GST Invoices</option>
                  <option value="ADMIN">ADMIN — Full System Access & Provisioning</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
                <button type="button" className="secondary" onClick={() => setShowUserModal(false)}>Cancel</button>
                <button type="submit" style={{ background: "var(--amber)", color: "#1B2430", fontWeight: 700 }}>Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 1: CUSTOMER FORM MODAL --- */}
      {showCustomerModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 1000, padding: 16 }}>
          <div className="card" style={{ maxWidth: 540, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h3>{editingCustomer ? "Edit Customer Record" : "Add New Customer"}</h3>
            <form onSubmit={handleSaveCustomer} className="form-stack" style={{ marginTop: 16 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Customer Name *</label>
                <input value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Mobile Number *</label>
                  <input value={customerForm.mobile} onChange={(e) => setCustomerForm({ ...customerForm, mobile: e.target.value })} required />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Email Address</label>
                  <input type="email" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Business Name</label>
                  <input value={customerForm.businessName} onChange={(e) => setCustomerForm({ ...customerForm, businessName: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>GST Number</label>
                  <input value={customerForm.gstNumber} onChange={(e) => setCustomerForm({ ...customerForm, gstNumber: e.target.value })} placeholder="e.g. 27AABCU9603R1ZN" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Customer Type</label>
                  <select value={customerForm.customerType} onChange={(e) => setCustomerForm({ ...customerForm, customerType: e.target.value as CustomerType })}>
                    <option value="WHOLESALE">WHOLESALE</option>
                    <option value="DISTRIBUTOR">DISTRIBUTOR</option>
                    <option value="RETAIL">RETAIL</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Status</label>
                  <select value={customerForm.status} onChange={(e) => setCustomerForm({ ...customerForm, status: e.target.value as CustomerStatus })}>
                    <option value="LEAD">LEAD</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Address</label>
                <textarea rows={2} value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Notes</label>
                <textarea rows={2} value={customerForm.notes} onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })} />
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
                <button type="button" className="secondary" onClick={() => setShowCustomerModal(false)}>Cancel</button>
                <button type="submit">Save Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: CUSTOMER DETAIL & FOLLOW-UP TIMELINE --- */}
      {activeCustomerDetail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 1000, padding: 16 }}>
          <div className="card" style={{ maxWidth: 640, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="section-heading">
              <h3>Customer Profile: {activeCustomerDetail.name}</h3>
              <button className="secondary" onClick={() => setActiveCustomerDetail(null)}>Close</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: "#FAF9F6", padding: 12, borderRadius: 6, margin: "16px 0" }}>
              <div><strong>Mobile:</strong> {activeCustomerDetail.mobile}</div>
              <div><strong>Email:</strong> {activeCustomerDetail.email || "N/A"}</div>
              <div><strong>Business:</strong> {activeCustomerDetail.businessName || "N/A"}</div>
              <div><strong>GST:</strong> <code>{activeCustomerDetail.gstNumber || "N/A"}</code></div>
              <div><strong>Type:</strong> {activeCustomerDetail.customerType}</div>
              <div><strong>Status:</strong> {activeCustomerDetail.status}</div>
              <div style={{ gridColumn: "span 2" }}><strong>Address:</strong> {activeCustomerDetail.address || "N/A"}</div>
            </div>

            <h4>CRM Follow-up Activity History</h4>
            <div style={{ margin: "12px 0", maxHeight: 200, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6, padding: 12 }}>
              {(!activeCustomerDetail.followUps || activeCustomerDetail.followUps.length === 0) ? (
                <div style={{ color: "var(--slate)", fontSize: 13 }}>No follow-up notes logged for this customer yet.</div>
              ) : (
                activeCustomerDetail.followUps.map((f) => (
                  <div key={f.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: "var(--slate)" }}>
                      <strong>{f.createdBy}</strong> on {new Date(f.createdAt).toLocaleString("en-IN")}
                      {f.followUpDate && <span style={{ marginLeft: 8, color: "var(--amber)", fontWeight: 600 }}>[Next Date: {new Date(f.followUpDate).toLocaleDateString("en-IN")}]</span>}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>{f.note}</div>
                  </div>
                ))
              )}
            </div>

            {canAccess(["ADMIN", "SALES"]) ? (
              <form onSubmit={handleAddFollowUp} className="form-stack" style={{ marginTop: 16 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>+ Add Follow-up Note</label>
                  <textarea rows={2} value={followUpNote} onChange={(e) => setFollowUpNote(e.target.value)} placeholder="Type notes from call or meeting..." required />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "center" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Next Scheduled Follow-up Date</label>
                    <input type="date" value={followUpDateInput} onChange={(e) => setFollowUpDateInput(e.target.value)} />
                  </div>
                  <button type="submit" style={{ marginTop: 18 }}>Post Follow-up Note</button>
                </div>
              </form>
            ) : (
              <div style={{ padding: 10, background: "#DEE6EE", color: "#43607C", borderRadius: 6, fontSize: 12, marginTop: 12 }}>
                🔒 Adding follow-up notes is restricted to Admin and Sales roles.
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL 3: PRODUCT FORM MODAL --- */}
      {showProductModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 1000, padding: 16 }}>
          <div className="card" style={{ maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h3>{editingProduct ? "Edit Product Details" : "Add New Product"}</h3>
            <form onSubmit={handleSaveProduct} className="form-stack" style={{ marginTop: 16 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Product Name *</label>
                <input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>SKU / Product Code *</label>
                  <input value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} required />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Category</label>
                  <input value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Unit Price (₹) *</label>
                  <input type="number" step="0.01" value={productForm.unitPrice} onChange={(e) => setProductForm({ ...productForm, unitPrice: Number(e.target.value) })} required />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Initial Stock Qty</label>
                  <input type="number" value={productForm.currentStock} onChange={(e) => setProductForm({ ...productForm, currentStock: Number(e.target.value) })} required />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Min Stock Alert Qty</label>
                  <input type="number" value={productForm.minStockAlert} onChange={(e) => setProductForm({ ...productForm, minStockAlert: Number(e.target.value) })} required />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Warehouse Rack Location</label>
                  <input value={productForm.location} onChange={(e) => setProductForm({ ...productForm, location: e.target.value })} placeholder="e.g. Rack A-12" />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
                <button type="button" className="secondary" onClick={() => setShowProductModal(false)}>Cancel</button>
                <button type="submit">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 4: STOCK MOVEMENTS LOG --- */}
      {activeProductMovements && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 1000, padding: 16 }}>
          <div className="card" style={{ maxWidth: 620, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="section-heading">
              <h3>Stock Movement Audit Log: {activeProductMovements.product.name}</h3>
              <button className="secondary" onClick={() => setActiveProductMovements(null)}>Close</button>
            </div>
            <div style={{ fontSize: 13, color: "var(--slate)", marginBottom: 12 }}>
              Current Stock: <strong>{activeProductMovements.product.currentStock} units</strong> | SKU: {activeProductMovements.product.sku}
            </div>

            <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6, padding: 8, marginBottom: 16 }}>
              {activeProductMovements.movements.length === 0 ? (
                <div style={{ color: "var(--slate)", fontSize: 13 }}>No stock movement records.</div>
              ) : (
                activeProductMovements.movements.map((m) => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "6px 4px", fontSize: 12 }}>
                    <div>
                      <span className="pill" style={{ background: m.movementType === "IN" ? "#DCEAE1" : "#F4DEDB", color: m.movementType === "IN" ? "#3F7D58" : "#B5473F", fontWeight: 700 }}>
                        {m.movementType} {m.quantityChanged}
                      </span>
                      <span style={{ marginLeft: 8 }}>{m.reason}</span>
                    </div>
                    <div style={{ color: "var(--slate)" }}>
                      {m.createdBy} ({new Date(m.timestamp).toLocaleDateString("en-IN")})
                    </div>
                  </div>
                ))
              )}
            </div>

            {canAccess(["ADMIN", "WAREHOUSE"]) ? (
              <form onSubmit={handleManualStockAdjustment} className="form-stack">
                <h4>Manual Stock Adjustment</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Type</label>
                    <select value={manualStockForm.movementType} onChange={(e) => setManualStockForm({ ...manualStockForm, movementType: e.target.value as MovementType })}>
                      <option value="IN">IN (+ Stock)</option>
                      <option value="OUT">OUT (- Stock)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Quantity</label>
                    <input type="number" min={1} value={manualStockForm.quantityChanged} onChange={(e) => setManualStockForm({ ...manualStockForm, quantityChanged: Number(e.target.value) })} required />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Reason / Ref</label>
                    <input value={manualStockForm.reason} onChange={(e) => setManualStockForm({ ...manualStockForm, reason: e.target.value })} placeholder="e.g. Shipment arrival" required />
                  </div>
                </div>
                <button type="submit" style={{ marginTop: 8 }}>Record Stock Movement</button>
              </form>
            ) : (
              <div style={{ padding: 10, background: "#DEE6EE", color: "#43607C", borderRadius: 6, fontSize: 12 }}>
                🔒 Manual stock movements are restricted to Admin and Warehouse staff.
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL 5: CHALLAN FORM MODAL --- */}
      {showChallanModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 1000, padding: 16 }}>
          <div className="card" style={{ maxWidth: 640, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h3>{editingChallanId ? "Edit Draft Sales Challan" : "Create New Sales Challan"}</h3>
            <form onSubmit={handleSaveChallan} className="form-stack" style={{ marginTop: 16 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Select Customer *</label>
                <select value={challanForm.customerId} onChange={(e) => setChallanForm({ ...challanForm, customerId: e.target.value })} required>
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.customerType})</option>
                  ))}
                </select>
              </div>

              <h4>Line Items</h4>
              {challanForm.items.map((itemRow, idx) => {
                const selectedProd = products.find((p) => p.id === itemRow.productId);
                return (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
                    <div>
                      <select value={itemRow.productId} onChange={(e) => updateChallanItemRow(idx, "productId", e.target.value)} required>
                        <option value="">-- Select Product --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} (Stock: {p.currentStock}) - ₹{p.unitPrice}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <input type="number" min={1} value={itemRow.quantity} onChange={(e) => updateChallanItemRow(idx, "quantity", Number(e.target.value))} required />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      ₹{((selectedProd?.unitPrice || 0) * (itemRow.quantity || 0)).toFixed(2)}
                    </div>
                    <div>
                      {challanForm.items.length > 1 && (
                        <button type="button" className="danger" style={{ padding: "6px 10px" }} onClick={() => removeChallanItemRow(idx)}>✕</button>
                      )}
                    </div>
                  </div>
                );
              })}

              <button type="button" className="secondary" onClick={addChallanItemRow} style={{ marginTop: 8 }}>+ Add Line Item</button>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
                <button type="button" className="secondary" onClick={() => setShowChallanModal(false)}>Cancel</button>
                <button type="submit">Save Challan as DRAFT</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 6: INVOICE PREVIEW MODAL --- */}
      {activeChallanInvoice && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", zIndex: 1000, padding: 16 }}>
          <div className="card" style={{ maxWidth: 700, width: "100%", maxHeight: "90vh", overflowY: "auto", background: "white" }}>
            <div className="section-heading" style={{ borderBottom: "2px solid var(--ink)", paddingBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 22, margin: 0 }}>DELIVERY CHALLAN & INVOICE</h2>
                <div style={{ fontSize: 12, color: "var(--slate)" }}>DistroOps Wholesale Operations Engine</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <h3 style={{ margin: 0 }}><code>{activeChallanInvoice.challanNumber}</code></h3>
                <span className="status-pill" style={{
                  background: activeChallanInvoice.status === "CONFIRMED" ? "#DCEAE1" : activeChallanInvoice.status === "DRAFT" ? "#F1D9AE" : "#F4DEDB",
                  color: activeChallanInvoice.status === "CONFIRMED" ? "#3F7D58" : activeChallanInvoice.status === "DRAFT" ? "#C98A2C" : "#B5473F"
                }}>
                  Status: {activeChallanInvoice.status}
                </span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "16px 0", fontSize: 13, background: "#FAF9F6", padding: 12, borderRadius: 6 }}>
              <div>
                <strong>Billed / Delivered To:</strong>
                <div>{customers.find((c) => c.id === activeChallanInvoice.customerId)?.name}</div>
                <div>{customers.find((c) => c.id === activeChallanInvoice.customerId)?.businessName}</div>
                <div>Address: {customers.find((c) => c.id === activeChallanInvoice.customerId)?.address || "N/A"}</div>
                <div>GST: {customers.find((c) => c.id === activeChallanInvoice.customerId)?.gstNumber || "N/A"}</div>
              </div>
              <div>
                <strong>Order Details:</strong>
                <div>Date: {new Date(activeChallanInvoice.createdAt).toLocaleDateString("en-IN")}</div>
                <div>Created By: {activeChallanInvoice.createdBy}</div>
                <div>Payment Terms: Standard 30 Days</div>
              </div>
            </div>

            <table style={{ margin: "16px 0" }}>
              <thead>
                <tr>
                  <th>Product (Snapshot Name)</th>
                  <th>SKU</th>
                  <th>Unit Price Snapshot</th>
                  <th>Qty</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {activeChallanInvoice.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.productNameSnapshot}</td>
                    <td><code>{item.skuSnapshot}</code></td>
                    <td>₹{item.unitPriceSnapshot.toFixed(2)}</td>
                    <td>{item.quantity} pcs</td>
                    <td>₹{(item.unitPriceSnapshot * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ width: 280, marginLeft: "auto", fontSize: 13, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span>Subtotal:</span>
                <strong>₹{activeChallanInvoice.subtotal.toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span>GST (Estimated 18%):</span>
                <span>₹{(activeChallanInvoice.subtotal * 0.18).toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, borderTop: "2px solid var(--ink)", paddingTop: 6, marginTop: 6 }}>
                <strong>Grand Total:</strong>
                <strong style={{ color: "var(--green)" }}>₹{(activeChallanInvoice.subtotal * 1.18).toFixed(2)}</strong>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "space-between", marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <button className="secondary" onClick={() => window.print()}>🖨️ Print GST Invoice</button>

              <div style={{ display: "flex", gap: 8 }}>
                <button className="secondary" onClick={() => setActiveChallanInvoice(null)}>Close</button>
                {activeChallanInvoice.status === "DRAFT" && canAccess(["ADMIN", "SALES", "ACCOUNTS"]) && (
                  <button style={{ background: "var(--green)", color: "white" }} onClick={() => handleConfirmChallan(activeChallanInvoice.id)}>Confirm Order & Deduct Stock</button>
                )}
                {activeChallanInvoice.status !== "CANCELLED" && canAccess(["ADMIN", "SALES", "ACCOUNTS"]) && (
                  <button className="danger" onClick={() => handleCancelChallan(activeChallanInvoice.id)}>Cancel Order</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
