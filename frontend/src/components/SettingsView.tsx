"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Settings,
  Trash2,
  Database,
  Shield,
  Info,
  HardDrive,
  Check,
  AlertTriangle,
  UserPlus,
  Users,
  Monitor,
  Mail,
  Bell,
  RefreshCw,
} from "lucide-react";
import { clearAllData, getStorageSize, getStorageEntries } from "@/lib/storage";

const API = "http://localhost:8001";

type Employee = {
  id: number;
  name: string;
  email: string;
  employee_id: string;
  device_count: number;
  event_count: number;
  threat_count: number;
};

type Device = {
  id: number;
  device_id: string;
  hostname: string;
  ip_address: string;
  employee_id: number | null;
  employee_name: string | null;
  employee_email: string | null;
  event_count: number;
  threat_count: number;
  last_seen: string;
};

type Notification = {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_email: string;
  threat_count: number;
  notified_at: string;
};

export default function SettingsView({
  eventCount,
  onClearData,
}: {
  eventCount: number;
  onClearData: () => void;
}) {
  const [tab, setTab] = useState<"general" | "employees" | "devices" | "notifications">("general");
  const [smtp, setSmtp] = useState({
    host: "", port: 587, username: "", password: "", use_tls: true, from_email: "", enabled: false,
  });
  const [smtpStatus, setSmtpStatus] = useState("");
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [newEmp, setNewEmp] = useState({ name: "", email: "", employee_id: "" });
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [serverDevice, setServerDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState("");

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(""), 3000);
  };

  const fetchEmployees = async () => {
    try {
      const r = await fetch(`${API}/api/employees`);
      setEmployees(await r.json());
    } catch {}
  };

  const fetchDevices = async () => {
    try {
      const [r, sr] = await Promise.all([
        fetch(`${API}/api/devices`),
        fetch(`${API}/api/device`),
      ]);
      setDevices(await r.json());
      setServerDevice(await sr.json());
    } catch {}
  };

  const fetchNotifications = async () => {
    try {
      const r = await fetch(`${API}/api/notifications`);
      setNotifications(await r.json());
    } catch {}
  };

  const fetchSmtp = async () => {
    try {
      const r = await fetch(`${API}/api/settings/smtp`);
      const data = await r.json();
      setSmtp({
        host: data.host || "", port: data.port || 587,
        username: data.username || "", password: data.password || "",
        use_tls: data.use_tls ?? true, from_email: data.from_email || "",
        enabled: data.enabled ?? false,
      });
    } catch {}
  };

  const saveSmtp = async () => {
    try {
      const r = await fetch(`${API}/api/settings/smtp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(smtp),
      });
      const data = await r.json();
      setSmtp(data);
      setSmtpStatus("SMTP settings saved");
      setTimeout(() => setSmtpStatus(""), 3000);
    } catch { setSmtpStatus("Failed to save"); setTimeout(() => setSmtpStatus(""), 3000); }
  };

  const testSmtp = async () => {
    setSmtpTesting(true);
    setSmtpStatus("Testing...");
    try {
      const r = await fetch(`${API}/api/settings/smtp/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(smtp),
      });
      const data = await r.json();
      if (data.success) {
        setSmtpStatus("Test email sent successfully!");
      } else {
        setSmtpStatus(`Test failed: ${data.error || "unknown error"}`);
      }
    } catch {
      setSmtpStatus("Test failed: could not reach server");
    }
    setSmtpTesting(false);
    setTimeout(() => setSmtpStatus(""), 5000);
  };

  useEffect(() => {
    Promise.all([fetchEmployees(), fetchDevices(), fetchNotifications(), fetchSmtp()]).finally(
      () => setLoading(false)
    );
  }, []);

  const handleCreateEmployee = async () => {
    if (!newEmp.name || !newEmp.email) return;
    try {
      await fetch(`${API}/api/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEmp),
      });
      setNewEmp({ name: "", email: "", employee_id: "" });
      await fetchEmployees();
      showStatus("Employee created");
    } catch {
      showStatus("Failed to create employee");
    }
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmp) return;
    try {
      await fetch(`${API}/api/employees/${editingEmp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingEmp.name,
          email: editingEmp.email,
          employee_id: editingEmp.employee_id,
        }),
      });
      setEditingEmp(null);
      await fetchEmployees();
      showStatus("Employee updated");
    } catch {
      showStatus("Failed to update employee");
    }
  };

  const handleDeleteEmployee = async (id: number) => {
    try {
      await fetch(`${API}/api/employees/${id}`, { method: "DELETE" });
      await fetchEmployees();
      await fetchDevices();
      showStatus("Employee removed");
    } catch {
      showStatus("Failed to delete employee");
    }
  };

  const handleAssignDevice = async (devicePk: number, employeeId: number | null) => {
    try {
      await fetch(`${API}/api/devices/${devicePk}/assign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employeeId }),
      });
      await fetchDevices();
      showStatus(employeeId ? "Device assigned" : "Device unassigned");
    } catch {
      showStatus("Failed to assign device");
    }
  };

  const handleCheckNotifications = async () => {
    try {
      const r = await fetch(`${API}/api/notifications/check-all`, { method: "POST" });
      const data = await r.json();
      await fetchNotifications();
      showStatus(`Checked ${data.results?.length || 0} employees`);
    } catch {
      showStatus("Failed to check notifications");
    }
  };

  const handleClearLocal = () => {
    clearAllData();
    onClearData();
    setCleared(true);
    setConfirmClear(false);
    setTimeout(() => setCleared(false), 3000);
  };

  const [confirmDbClear, setConfirmDbClear] = useState(false);
  const [dbCleared, setDbCleared] = useState(false);

  const handleClearDb = async () => {
    try {
      const r = await fetch(`${API}/api/events/clear`, { method: "DELETE" });
      const data = await r.json();
      setDbCleared(true);
      setConfirmDbClear(false);
      showStatus(`Database cleared: ${data.deleted_count} events removed`);
      setTimeout(() => setDbCleared(false), 3000);
    } catch {
      showStatus("Failed to clear database");
    }
  };

  const storageSize = getStorageSize();

  const tabs = [
    { id: "general" as const, label: "General", icon: Settings },
    { id: "employees" as const, label: "Employees", icon: Users },
    { id: "devices" as const, label: "Devices", icon: Monitor },
    { id: "notifications" as const, label: "Alerts", icon: Bell },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-200 font-mono">
          Settings
        </h2>
        <p className="text-[10px] text-zinc-600 font-mono mt-1">
          Manage employees, devices, and application data
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 border-b border-white/[0.04] pb-3">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono transition-all",
              tab === id
                ? "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20"
                : "text-zinc-600 hover:text-zinc-400 border border-transparent"
            )}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-[10px] text-zinc-600 font-mono animate-pulse">Loading...</div>
        </div>
      ) : (
        <>
          {/* Status message */}
          {statusMsg && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] font-mono text-neon-green text-center"
            >
              {statusMsg}
            </motion.div>
          )}

          {/* ── GENERAL ── */}
          {tab === "general" && (
            <div className="grid grid-cols-12 gap-5">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="col-span-6 glass rounded-xl border border-white/[0.04] p-5 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-neon-cyan/10 flex items-center justify-center">
                    <Database className="w-3.5 h-3.5 text-neon-cyan" />
                  </div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-mono">
                    Data Management
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-white/[0.04]">
                    <div className="flex items-center gap-3">
                      <HardDrive className="w-4 h-4 text-zinc-600" />
                      <div>
                        <div className="text-[10px] text-zinc-400 font-mono">Stored Events</div>
                        <div className="text-[9px] text-zinc-600 font-mono mt-0.5">
                          {eventCount} in memory · {storageSize} local
                        </div>
                      </div>
                    </div>
                  </div>
                  {cleared ? (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 p-3 rounded-lg bg-neon-green/10 border border-neon-green/20"
                    >
                      <Check className="w-4 h-4 text-neon-green" />
                      <span className="text-[10px] font-mono text-neon-green">
                        Local cache cleared
                      </span>
                    </motion.div>
                  ) : confirmClear ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-neon-red/10 border border-neon-red/20">
                        <AlertTriangle className="w-4 h-4 text-neon-red shrink-0" />
                        <span className="text-[10px] font-mono text-neon-red">
                          Permanently delete all local cache?
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleClearLocal} className="flex-1 py-2 rounded-lg text-[10px] font-mono bg-neon-red/15 border border-neon-red/30 text-neon-red hover:bg-neon-red/25 transition-all">
                          Confirm
                        </button>
                        <button onClick={() => setConfirmClear(false)} className="flex-1 py-2 rounded-lg text-[10px] font-mono border border-white/8 text-zinc-500 hover:bg-white/5 transition-all">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmClear(true)}
                      className="w-full py-2.5 rounded-lg text-[10px] font-mono border border-neon-red/20 text-neon-red/70 hover:bg-neon-red/10 hover:text-neon-red transition-all flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear Local Cache
                    </button>
                  )}

                  {dbCleared ? (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 p-3 rounded-lg bg-neon-green/10 border border-neon-green/20"
                    >
                      <Check className="w-4 h-4 text-neon-green" />
                      <span className="text-[10px] font-mono text-neon-green">
                        Database events cleared
                      </span>
                    </motion.div>
                  ) : confirmDbClear ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-neon-red/10 border border-neon-red/20">
                        <AlertTriangle className="w-4 h-4 text-neon-red shrink-0" />
                        <span className="text-[10px] font-mono text-neon-red">
                          Permanently delete all events from database?
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleClearDb} className="flex-1 py-2 rounded-lg text-[10px] font-mono bg-neon-red/15 border border-neon-red/30 text-neon-red hover:bg-neon-red/25 transition-all">
                          Confirm
                        </button>
                        <button onClick={() => setConfirmDbClear(false)} className="flex-1 py-2 rounded-lg text-[10px] font-mono border border-white/8 text-zinc-500 hover:bg-white/5 transition-all">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDbClear(true)}
                      className="w-full py-2.5 rounded-lg text-[10px] font-mono border border-neon-red/20 text-neon-red/70 hover:bg-neon-red/10 hover:text-neon-red transition-all flex items-center justify-center gap-2"
                    >
                      <Database className="w-3.5 h-3.5" />
                      Clear Database Events
                    </button>
                  )}
                </div>
              </motion.div>

              {/* About */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="col-span-6 glass rounded-xl border border-white/[0.04] p-5 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-neon-purple/10 flex items-center justify-center">
                    <Info className="w-3.5 h-3.5 text-neon-purple" />
                  </div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-mono">About</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-black/30 border border-white/[0.04]">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neon-cyan/20 to-neon-blue/20 border border-neon-cyan/30 flex items-center justify-center">
                      <Shield className="w-4.5 h-4.5 text-neon-cyan" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white font-mono tracking-wider">SENTINEL AI</div>
                      <div className="text-[9px] text-zinc-600 font-mono mt-0.5">Privacy-First DLP Platform</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-lg bg-black/30 border border-white/[0.04]">
                      <div className="text-[8px] text-zinc-600 font-mono tracking-wider uppercase">Version</div>
                      <div className="text-[10px] text-zinc-400 font-mono mt-1">1.0.0</div>
                    </div>
                    <div className="p-3 rounded-lg bg-black/30 border border-white/[0.04]">
                      <div className="text-[8px] text-zinc-600 font-mono tracking-wider uppercase">Data</div>
                      <div className="text-[10px] text-neon-green font-mono mt-1 flex items-center gap-1">
                        <Shield className="w-3 h-3" />100% Local
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* ── EMPLOYEES ── */}
          {tab === "employees" && (
            <div className="grid grid-cols-12 gap-5">
              {/* Add / Edit */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="col-span-5 glass rounded-xl border border-white/[0.04] p-5 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-neon-cyan/10 flex items-center justify-center">
                    <UserPlus className="w-3.5 h-3.5 text-neon-cyan" />
                  </div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-mono">
                    {editingEmp ? "Edit Employee" : "Add Employee"}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[8px] text-zinc-600 font-mono tracking-wider uppercase block mb-1">Name</label>
                    <input
                      value={editingEmp ? editingEmp.name : newEmp.name}
                      onChange={(e) =>
                        editingEmp
                          ? setEditingEmp({ ...editingEmp, name: e.target.value })
                          : setNewEmp({ ...newEmp, name: e.target.value })
                      }
                      className="w-full h-9 bg-black/30 border border-white/[0.06] rounded-lg px-3 text-[10px] font-mono text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-neon-cyan/30"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] text-zinc-600 font-mono tracking-wider uppercase block mb-1">Email</label>
                    <input
                      value={editingEmp ? editingEmp.email : newEmp.email}
                      onChange={(e) =>
                        editingEmp
                          ? setEditingEmp({ ...editingEmp, email: e.target.value })
                          : setNewEmp({ ...newEmp, email: e.target.value })
                      }
                      className="w-full h-9 bg-black/30 border border-white/[0.06] rounded-lg px-3 text-[10px] font-mono text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-neon-cyan/30"
                      placeholder="john@company.com"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] text-zinc-600 font-mono tracking-wider uppercase block mb-1">Employee ID</label>
                    <input
                      value={editingEmp ? editingEmp.employee_id : newEmp.employee_id}
                      onChange={(e) =>
                        editingEmp
                          ? setEditingEmp({ ...editingEmp, employee_id: e.target.value })
                          : setNewEmp({ ...newEmp, employee_id: e.target.value })
                      }
                      className="w-full h-9 bg-black/30 border border-white/[0.06] rounded-lg px-3 text-[10px] font-mono text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-neon-cyan/30"
                      placeholder="EMP-001"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={editingEmp ? handleUpdateEmployee : handleCreateEmployee}
                      disabled={editingEmp ? !editingEmp.name || !editingEmp.email : !newEmp.name || !newEmp.email}
                      className="flex-1 py-2 rounded-lg text-[10px] font-mono bg-neon-cyan/10 border border-neon-cyan/25 text-neon-cyan hover:bg-neon-cyan/20 transition-all disabled:opacity-40"
                    >
                      {editingEmp ? "Update" : "Add Employee"}
                    </button>
                    {editingEmp && (
                      <button
                        onClick={() => setEditingEmp(null)}
                        className="px-4 py-2 rounded-lg text-[10px] font-mono border border-white/8 text-zinc-500 hover:bg-white/5 transition-all"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Employee List */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="col-span-7 glass rounded-xl border border-white/[0.04] p-5 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-neon-cyan/10 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-neon-cyan" />
                  </div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-mono">
                    Employees ({employees.length})
                  </span>
                </div>

                {employees.length === 0 ? (
                  <div className="text-[10px] text-zinc-600 font-mono text-center py-8">
                    No employees registered. Add one to assign devices.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {employees.map((emp) => (
                      <div
                        key={emp.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-white/[0.04]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] text-zinc-300 font-medium truncate">{emp.name}</div>
                          <div className="text-[8px] text-zinc-600 font-mono mt-0.5 truncate">
                            {emp.email}
                            {emp.employee_id && ` · ${emp.employee_id}`}
                          </div>
                          <div className="text-[7px] text-zinc-700 font-mono mt-0.5">
                            {emp.device_count} device{emp.device_count !== 1 ? "s" : ""} · {emp.event_count} events ·{" "}
                            <span className={emp.threat_count > 0 ? "text-neon-red" : "text-zinc-600"}>
                              {emp.threat_count} threats
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1.5 ml-3 shrink-0">
                          <button
                            onClick={() => setEditingEmp(emp)}
                            className="px-2 py-1 rounded text-[8px] font-mono border border-white/8 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(emp.id)}
                            className="px-2 py-1 rounded text-[8px] font-mono border border-neon-red/15 text-neon-red/60 hover:text-neon-red hover:bg-neon-red/10 transition-all"
                          >
                            Del
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>
          )}

          {/* ── DEVICES ── */}
          {tab === "devices" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl border border-white/[0.04] p-5 space-y-4"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-neon-cyan/10 flex items-center justify-center">
                  <Monitor className="w-3.5 h-3.5 text-neon-cyan" />
                </div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-mono">
                  Devices ({devices.length})
                </span>
              </div>

              {serverDevice && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-neon-green/5 border border-neon-green/15">
                  <Shield className="w-4 h-4 text-neon-green shrink-0" />
                  <div className="text-[10px] font-mono text-neon-green/90">
                    This server: <span className="font-bold">{serverDevice.hostname}</span> ({serverDevice.ip_address})
                  </div>
                </div>
              )}

              {devices.length === 0 ? (
                <div className="text-[10px] text-zinc-600 font-mono text-center py-8">
                  No devices detected.
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {devices.map((dev) => (
                    <div
                      key={dev.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-white/[0.04]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-300 font-medium">{dev.hostname || dev.device_id}</span>
                          <span className="text-[7px] text-zinc-700 font-mono">#{dev.id}</span>
                        </div>
                        <div className="text-[8px] text-zinc-600 font-mono mt-0.5">
                          {dev.ip_address} · {dev.event_count} events ·{" "}
                          <span className={dev.threat_count > 0 ? "text-neon-red" : "text-zinc-600"}>
                            {dev.threat_count} threats
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <select
                          value={dev.employee_id ?? ""}
                          onChange={(e) => handleAssignDevice(dev.id, e.target.value ? Number(e.target.value) : null)}
                          className="bg-black/60 border border-white/[0.08] rounded-lg px-2 py-1.5 text-[9px] font-mono text-zinc-400 focus:outline-none focus:border-neon-cyan/30"
                        >
                          <option value="">Unassigned</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name}
                            </option>
                          ))}
                        </select>
                        {dev.employee_name && (
                          <span className="text-[8px] text-neon-cyan/70 font-mono">{dev.employee_name}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {tab === "notifications" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl border border-white/[0.04] p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-neon-cyan/10 flex items-center justify-center">
                    <Bell className="w-3.5 h-3.5 text-neon-cyan" />
                  </div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-mono">
                    Email Alerts
                  </span>
                </div>
                <button
                  onClick={handleCheckNotifications}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-mono bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/20 transition-all"
                >
                  <RefreshCw className="w-3 h-3" />
                  Check All
                </button>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
                <div className="text-[8px] text-amber-400/60 font-mono tracking-wider mb-1 uppercase">
                  How it works
                </div>
                <div className="text-[9px] text-amber-300/70 font-mono leading-relaxed">
                  When an employee&apos;s device has 3 or more HIGH/CRITICAL threats, an alert is logged here.
                  Configure SMTP settings to send real emails.
                </div>
              </div>

              {notifications.length === 0 ? (
                <div className="text-[10px] text-zinc-600 font-mono text-center py-8">
                  No alerts triggered yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-neon-red/5 border border-neon-red/15"
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-neon-red shrink-0" />
                        <div>
                          <div className="text-[10px] text-zinc-300 font-medium">{n.employee_name}</div>
                          <div className="text-[8px] text-zinc-600 font-mono mt-0.5">{n.employee_email}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-mono text-neon-red font-semibold">{n.threat_count} threats</div>
                        <div className="text-[7px] text-zinc-600 font-mono mt-0.5">
                          {new Date(n.notified_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── SMTP Configuration ── */}
              <div className="border-t border-white/[0.04] pt-4 mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-neon-cyan/10 flex items-center justify-center">
                    <Mail className="w-3.5 h-3.5 text-neon-cyan" />
                  </div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-mono">
                    SMTP Configuration
                  </span>
                </div>

                <div className="space-y-3">
                  {smtpStatus && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "text-[9px] font-mono px-3 py-2 rounded-lg",
                        smtpStatus.includes("failed") || smtpStatus.includes("error")
                          ? "bg-neon-red/10 text-neon-red border border-neon-red/20"
                          : smtpStatus.includes("Testing")
                            ? "bg-neon-yellow/10 text-neon-yellow border border-neon-yellow/20"
                            : "bg-neon-green/10 text-neon-green border border-neon-green/20"
                      )}
                    >
                      {smtpStatus}
                    </motion.div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[8px] text-zinc-600 font-mono tracking-wider uppercase block mb-1">SMTP Host</label>
                      <input
                        value={smtp.host}
                        onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                        className="w-full h-9 bg-black/30 border border-white/[0.06] rounded-lg px-3 text-[10px] font-mono text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-neon-cyan/30"
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] text-zinc-600 font-mono tracking-wider uppercase block mb-1">Port</label>
                      <input
                        type="number"
                        value={smtp.port}
                        onChange={(e) => setSmtp({ ...smtp, port: parseInt(e.target.value) || 587 })}
                        className="w-full h-9 bg-black/30 border border-white/[0.06] rounded-lg px-3 text-[10px] font-mono text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-neon-cyan/30"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] text-zinc-600 font-mono tracking-wider uppercase block mb-1">Username</label>
                      <input
                        value={smtp.username}
                        onChange={(e) => setSmtp({ ...smtp, username: e.target.value })}
                        className="w-full h-9 bg-black/30 border border-white/[0.06] rounded-lg px-3 text-[10px] font-mono text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-neon-cyan/30"
                        placeholder="user@gmail.com"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] text-zinc-600 font-mono tracking-wider uppercase block mb-1">Password</label>
                      <input
                        type="password"
                        value={smtp.password}
                        onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                        className="w-full h-9 bg-black/30 border border-white/[0.06] rounded-lg px-3 text-[10px] font-mono text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-neon-cyan/30"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] text-zinc-600 font-mono tracking-wider uppercase block mb-1">From Email</label>
                      <input
                        value={smtp.from_email}
                        onChange={(e) => setSmtp({ ...smtp, from_email: e.target.value })}
                        className="w-full h-9 bg-black/30 border border-white/[0.06] rounded-lg px-3 text-[10px] font-mono text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-neon-cyan/30"
                        placeholder="sentinel@company.com"
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <button
                          onClick={() => setSmtp({ ...smtp, use_tls: !smtp.use_tls })}
                          className={cn(
                            "relative w-8 h-4 rounded-full transition-colors duration-300",
                            smtp.use_tls ? "bg-neon-cyan" : "bg-zinc-700"
                          )}
                        >
                          <motion.div
                            animate={{ x: smtp.use_tls ? 16 : 2 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow"
                          />
                        </button>
                        <span className="text-[9px] font-mono text-zinc-500">TLS Enabled</span>
                      </label>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <button
                      onClick={() => setSmtp({ ...smtp, enabled: !smtp.enabled })}
                      className={cn(
                        "relative w-8 h-4 rounded-full transition-colors duration-300",
                        smtp.enabled ? "bg-neon-green" : "bg-zinc-700"
                      )}
                    >
                      <motion.div
                        animate={{ x: smtp.enabled ? 16 : 2 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow"
                      />
                    </button>
                    <span className="text-[9px] font-mono text-zinc-400">Enable automated email alerts</span>
                  </label>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={saveSmtp}
                      className="flex-1 py-2.5 rounded-lg text-[10px] font-mono bg-neon-cyan/10 border border-neon-cyan/25 text-neon-cyan hover:bg-neon-cyan/20 transition-all"
                    >
                      Save Settings
                    </button>
                    <button
                      onClick={testSmtp}
                      disabled={smtpTesting || !smtp.host}
                      className="flex-1 py-2.5 rounded-lg text-[10px] font-mono border border-white/8 text-zinc-400 hover:bg-white/5 hover:text-zinc-300 transition-all disabled:opacity-40"
                    >
                      {smtpTesting ? "Testing..." : "Test Connection"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
