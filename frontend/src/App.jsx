
import { useEffect, useState } from "react";
import "./App.css";

// Local backend for development.
// We will configure the production URL when deploying the frontend.
const API_BASE_URL = "http://localhost:8000";

function formatDate(dateValue) {
  if (!dateValue) return "—";

  return new Date(dateValue).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function App() {
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    source_account: "",
    destination_account: "",
    amount: "",
    currency: "INR",
  });

// Load saved transactions from the database when the dashboard opens.
useEffect(() => {
  const fetchTransactions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/transactions`);

      if (!response.ok) {
        throw new Error(`Unable to load transactions: ${response.status}`);
      }

      const data = await response.json();

      const savedTransactions = data.map((transaction) => ({
        id: transaction.transaction_id,
        source: transaction.source_account,
        destination: transaction.destination_account,
        amount: Number(transaction.amount),
        currency: transaction.currency,
        status: transaction.status,
        date: formatDate(transaction.created_at),
      }));

      setTransactions(savedTransactions);
    } catch (err) {
      console.error("Unable to load transaction history:", err);
      setError("Unable to load transaction history. Please check the backend.");
    } finally {
      setHistoryLoading(false);
    }
  };

  fetchTransactions();
}, []);

  // Automatically refresh transactions that are still processing.
  useEffect(() => {
    const processingTransactions = transactions.filter(
      (item) => item.status === "PROCESSING"
    );

    if (processingTransactions.length === 0) return;

    const timer = setInterval(async () => {
      for (const item of processingTransactions) {
        try {
          const response = await fetch(
            `${API_BASE_URL}/v1/transactions/${encodeURIComponent(item.id)}`
          );

          if (!response.ok) continue;

          const data = await response.json();
          const updatedTransaction = Array.isArray(data) ? data[0] : data;

          if (updatedTransaction) {
            setTransactions((previous) =>
              previous.map((transaction) =>
                transaction.id === updatedTransaction.transaction_id
                  ? {
                      ...transaction,
                      status: updatedTransaction.status,
                      date: formatDate(updatedTransaction.created_at),
                    }
                  : transaction
              )
            );
          }
        } catch (err) {
          console.error("Unable to refresh transaction:", err);
        }
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [transactions]);

  const completed = transactions.filter(
    (item) => item.status === "PROCESSED"
  ).length;

  const processing = transactions.filter(
    (item) => item.status === "PROCESSING"
  ).length;

  const totalAmount = transactions.reduce(
    (sum, item) => sum + Number(item.amount),
    0
  );

  const filteredTransactions = transactions.filter((item) => {
    const matchesSearch =
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.source.toLowerCase().includes(search.toLowerCase()) ||
      item.destination.toLowerCase().includes(search.toLowerCase());

    const matchesFilter =
      filter === "ALL" || item.status === filter;

    return matchesSearch && matchesFilter;
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const transactionId = `txn_${crypto.randomUUID().replaceAll("-", "")}`;

    const payload = {
      transaction_id: transactionId,
      source_account: form.source_account.trim(),
      destination_account: form.destination_account.trim(),
      amount: Number(form.amount),
      currency: form.currency,
    };

    try {
      const response = await fetch(
        `${API_BASE_URL}/v1/webhooks/transactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Request failed with status ${response.status}`
        );
      }

      const newTransaction = {
        id: transactionId,
        source: payload.source_account,
        destination: payload.destination_account,
        amount: payload.amount,
        currency: payload.currency,
        status: "PROCESSING",
        date: formatDate(new Date()),
      };

      setTransactions((previous) => [newTransaction, ...previous]);

      setForm({
        source_account: "",
        destination_account: "",
        amount: "",
        currency: "INR",
      });

      setShowForm(false);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Could not connect to the backend. Please check that your API is running."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">W</div>
          <div>
            <h2>WalnutPay</h2>
            <span>TRANSACTION HUB</span>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <nav>
          <a className="nav-item active" href="#dashboard">
            <span>▦</span> Overview
          </a>
          <a className="nav-item" href="#transactions">
            <span>⇄</span> Transactions
          </a>
          <a className="nav-item" href="#activity">
            <span>◷</span> Activity
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="online-indicator">
            <span className="online-dot"></span>
            System operational
          </div>
          <div className="profile">
            <div className="avatar">B</div>
            <div>
              <strong>Administrator</strong>
              <span>Transaction Manager</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div>
            <div className="breadcrumb">Workspace / Overview</div>
            <h1>Transaction Overview</h1>
            <p>Monitor and manage your payment activity.</p>
          </div>

          <div className="top-actions">
            <span className="live-badge">
              <span className="online-dot"></span> API connected locally
            </span>
            <button className="primary-btn" onClick={() => setShowForm(true)}>
              + New transaction
            </button>
          </div>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-top">
              <span>Total transactions</span>
              <span className="stat-icon purple">⇄</span>
            </div>
            <h2>{transactions.length}</h2>
            <p>All recorded transactions</p>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Processed</span>
              <span className="stat-icon green">✓</span>
            </div>
            <h2>{completed}</h2>
            <p>Successfully completed</p>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Processing</span>
              <span className="stat-icon orange">◷</span>
            </div>
            <h2>{processing}</h2>
            <p>Awaiting completion</p>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Total value</span>
              <span className="stat-icon blue">₹</span>
            </div>
            <h2>₹{totalAmount.toLocaleString("en-IN")}</h2>
            <p>Combined transaction amount</p>
          </div>
        </section>

        <section className="content-card" id="transactions">
          <div className="section-heading">
            <div>
              <h2>Recent transactions</h2>
              <p>Review and track your latest payment activity.</p>
            </div>
            <button
              className="secondary-btn"
              onClick={() => {
                setSearch("");
                setFilter("ALL");
              }}
            >
              Reset filters
            </button>
          </div>

          <div className="toolbar">
            <input
              className="search-input"
              placeholder="⌕  Search transaction or account..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              className="filter-select"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="ALL">All statuses</option>
              <option value="PROCESSED">Processed</option>
              <option value="PROCESSING">Processing</option>
            </select>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>TRANSACTION ID</th>
                  <th>SOURCE ACCOUNT</th>
                  <th>DESTINATION</th>
                  <th>AMOUNT</th>
                  <th>STATUS</th>
                  <th>DATE</th>
                </tr>
              </thead>

              <tbody>
                {filteredTransactions.map((item) => (
                  <tr key={item.id}>
                    <td className="transaction-id">{item.id}</td>
                    <td>{item.source}</td>
                    <td>{item.destination}</td>
                    <td className="amount">
                      {item.currency}{" "}
                      {Number(item.amount).toLocaleString("en-IN")}
                    </td>
                    <td>
                      <span
                        className={`status ${
                          item.status === "PROCESSED"
                            ? "success"
                            : "pending"
                        }`}
                      >
                        {item.status === "PROCESSED" ? "●" : "◷"}{" "}
                        {item.status}
                      </span>
                    </td>
                    <td>{item.date}</td>
                  </tr>
                ))}

                {historyLoading ? (
  <tr>
    <td colSpan="6" className="empty-state">
      Loading transaction history...
    </td>
  </tr>
) : filteredTransactions.length === 0 ? (
  <tr>
    <td colSpan="6" className="empty-state">
      No transactions found.
    </td>
  </tr>
) : null}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </div>
        </section>

        <footer className="footer">
          <span>WalnutPay Transaction Hub</span>
          <span>Secure transaction monitoring platform</span>
        </footer>
      </main>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-heading">
              <div>
                <h2>Create transaction</h2>
                <p>Enter the payment details below.</p>
              </div>
              <button
                className="close-btn"
                onClick={() => {
                  setShowForm(false);
                  setError("");
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label>Source account</label>
              <input
                required
                value={form.source_account}
                onChange={(event) =>
                  setForm({ ...form, source_account: event.target.value })
                }
                placeholder="e.g. acc_user_789"
              />

              <label>Destination account</label>
              <input
                required
                value={form.destination_account}
                onChange={(event) =>
                  setForm({
                    ...form,
                    destination_account: event.target.value,
                  })
                }
                placeholder="e.g. acc_merchant_456"
              />

              <label>Amount</label>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) =>
                  setForm({ ...form, amount: event.target.value })
                }
                placeholder="Enter amount"
              />

              <label>Currency</label>
              <select
                value={form.currency}
                onChange={(event) =>
                  setForm({ ...form, currency: event.target.value })
                }
              >
                <option value="INR">INR – Indian Rupee</option>
                <option value="USD">USD – US Dollar</option>
                <option value="EUR">EUR – Euro</option>
              </select>

              {error && (
                <p style={{ color: "#dc2626", fontSize: "13px" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="primary-btn submit-btn"
                disabled={loading}
              >
                {loading ? "Submitting..." : "Create transaction"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
