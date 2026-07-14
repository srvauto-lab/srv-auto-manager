"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Check,
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserRound,
  X,
} from "lucide-react";

type UserRole =
  | "admin"
  | "chief_mechanic"
  | "reception"
  | "mechanic"
  | "accountant"
  | "warehouse";

type UserRecord = {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  full_name: string;
  role: UserRole;
  phone: string;
  is_active: boolean;
};

type Permission = {
  permission_key: string;
  label: string;
  section: string;
  description: string | null;
  sort_order: number;
};

type RolePermission = {
  role: UserRole;
  permission_key: string;
  allowed: boolean;
};

type Override = {
  user_id: string;
  permission_key: string;
  allowed: boolean;
};

const roleLabels: Record<UserRole, string> = {
  admin: "Администратор",
  chief_mechanic: "Главный механик",
  reception: "Приёмщик",
  mechanic: "Механик",
  accountant: "Бухгалтер",
  warehouse: "Склад",
};

const roleOptions = Object.entries(roleLabels) as Array<[UserRole, string]>;

function formatDate(value: string | null | undefined) {
  if (!value) return "Никогда";
  return new Date(value).toLocaleString("fr-FR");
}

export default function AccessPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingUser, setSavingUser] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [createForm, setCreateForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "mechanic" as UserRole,
  });

  const [editForm, setEditForm] = useState({
    id: "",
    full_name: "",
    role: "mechanic" as UserRole,
    is_active: true,
  });

  const [permissionDraft, setPermissionDraft] = useState<
    Record<string, boolean | null>
  >({});

  async function apiFetch<T>(
    url: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Ошибка запроса.");
    }

    return data as T;
  }

  async function loadUsers() {
    const data = await apiFetch<{ users: UserRecord[] }>(
      "/api/admin/users"
    );
    setUsers(data.users || []);
  }

  async function loadPermissions(userId?: string) {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";

    const data = await apiFetch<{
      permissions: Permission[];
      role_permissions: RolePermission[];
      overrides: Override[];
    }>(`/api/admin/permissions${query}`);

    setPermissions(data.permissions || []);
    setRolePermissions(data.role_permissions || []);
    setOverrides(data.overrides || []);

    const nextDraft: Record<string, boolean | null> = {};

    for (const permission of data.permissions || []) {
      const override = (data.overrides || []).find(
        (item) =>
          item.permission_key === permission.permission_key &&
          item.user_id === userId
      );

      nextDraft[permission.permission_key] =
        override !== undefined ? override.allowed : null;
    }

    setPermissionDraft(nextDraft);
  }

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);

      try {
        await Promise.all([loadUsers(), loadPermissions()]);
      } catch (error) {
        alert(error instanceof Error ? error.message : "Ошибка загрузки.");
      } finally {
        setLoading(false);
      }
    }

    void bootstrap();
  }, []);

  const selectedUser = users.find((user) => user.id === selectedUserId) || null;

  const filteredUsers = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return users;

    return users.filter((user) =>
      [user.full_name, user.email, roleLabels[user.role]]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [users, search]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, Permission[]>();

    for (const permission of permissions) {
      const current = groups.get(permission.section) || [];
      current.push(permission);
      groups.set(permission.section, current);
    }

    return Array.from(groups.entries());
  }, [permissions]);

  function roleDefaultAllowed(
    role: UserRole,
    permissionKey: string
  ) {
    if (role === "admin") return true;

    return rolePermissions.some(
      (item) =>
        item.role === role &&
        item.permission_key === permissionKey &&
        item.allowed
    );
  }

  function openEdit(user: UserRecord) {
    setEditForm({
      id: user.id,
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
    });
    setEditOpen(true);
  }

  async function openPermissions(user: UserRecord) {
    setSelectedUserId(user.id);

    try {
      await loadPermissions(user.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ошибка загрузки прав.");
    }
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setSavingUser(true);

    try {
      await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(createForm),
      });

      setCreateOpen(false);
      setCreateForm({
        full_name: "",
        email: "",
        password: "",
        role: "mechanic",
      });

      await loadUsers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ошибка создания.");
    } finally {
      setSavingUser(false);
    }
  }

  async function updateUser(event: FormEvent) {
    event.preventDefault();
    setSavingUser(true);

    try {
      await apiFetch("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });

      setEditOpen(false);
      await loadUsers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ошибка сохранения.");
    } finally {
      setSavingUser(false);
    }
  }

  async function deleteUser(user: UserRecord) {
    const confirmed = confirm(
      `Удалить аккаунт сотрудника «${user.full_name || user.email}»?\n\nЭто действие необратимо.`
    );

    if (!confirmed) return;

    try {
      await apiFetch("/api/admin/users", {
        method: "DELETE",
        body: JSON.stringify({ id: user.id }),
      });

      if (selectedUserId === user.id) {
        setSelectedUserId(null);
        setPermissionDraft({});
      }

      await loadUsers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ошибка удаления.");
    }
  }

  async function savePermissions() {
    if (!selectedUser) return;

    if (selectedUser.role === "admin") {
      alert("Администратор всегда имеет полный доступ.");
      return;
    }

    setSavingPermissions(true);

    try {
      const normalizedOverrides = Object.entries(permissionDraft)
        .filter(([, value]) => value !== null)
        .map(([permission_key, allowed]) => ({
          permission_key,
          allowed,
        }));

      await apiFetch("/api/admin/permissions", {
        method: "PUT",
        body: JSON.stringify({
          user_id: selectedUser.id,
          overrides: normalizedOverrides,
        }),
      });

      await loadPermissions(selectedUser.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ошибка сохранения прав.");
    } finally {
      setSavingPermissions(false);
    }
  }

  function effectivePermission(permissionKey: string) {
    if (!selectedUser) return false;

    const override = permissionDraft[permissionKey];

    if (override !== null && override !== undefined) {
      return override;
    }

    return roleDefaultAllowed(selectedUser.role, permissionKey);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <div className="flex min-h-[50vh] items-center justify-center">
          <p className="text-zinc-400">Загрузка пользователей...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-white sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-green-400">
            Права доступа
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Пользователи, роли и индивидуальные разрешения
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-3 text-sm font-bold text-black hover:bg-green-400"
        >
          <Plus size={18} />
          Новый сотрудник
        </button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,1fr)]">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
          <label className="relative block">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Имя, email или роль..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-3 pl-10 pr-4 outline-none focus:border-green-500"
            />
          </label>

          <div className="mt-4 space-y-3">
            {filteredUsers.map((user) => (
              <article
                key={user.id}
                className={`rounded-xl border p-4 transition ${
                  selectedUserId === user.id
                    ? "border-green-500 bg-green-500/5"
                    : "border-zinc-800 bg-zinc-950"
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-green-400">
                      <UserRound size={19} />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-bold">
                        {user.full_name || "Без имени"}
                      </p>
                      <p className="truncate text-sm text-zinc-500">
                        {user.email}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-green-400">
                          {roleLabels[user.role]}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${
                            user.is_active
                              ? "bg-green-500/15 text-green-400"
                              : "bg-red-500/15 text-red-400"
                          }`}
                        >
                          {user.is_active ? "Активен" : "Отключён"}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-zinc-600">
                        Последний вход: {formatDate(user.last_sign_in_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openPermissions(user)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-bold hover:bg-zinc-700"
                    >
                      <ShieldCheck size={15} />
                      Права
                    </button>

                    <button
                      type="button"
                      onClick={() => openEdit(user)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold hover:bg-blue-500"
                    >
                      <Pencil size={15} />
                      Изменить
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteUser(user)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold hover:bg-red-500"
                    >
                      <Trash2 size={15} />
                      Удалить
                    </button>
                  </div>
                </div>
              </article>
            ))}

            {!filteredUsers.length && (
              <p className="py-8 text-center text-zinc-500">
                Пользователи не найдены.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
          {!selectedUser ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
              <UserCog size={42} className="text-zinc-700" />
              <p className="mt-4 font-bold">Выбери сотрудника</p>
              <p className="mt-2 max-w-sm text-sm text-zinc-500">
                Нажми «Права» рядом с сотрудником, чтобы увидеть и изменить его индивидуальные разрешения.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-green-400">
                    {selectedUser.full_name || selectedUser.email}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Базовая роль: {roleLabels[selectedUser.role]}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedUserId(null);
                    setPermissionDraft({});
                  }}
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {selectedUser.role === "admin" ? (
                <div className="mt-6 rounded-xl border border-green-900 bg-green-950/20 p-4 text-sm text-green-300">
                  Администратор всегда имеет полный доступ. Индивидуальные ограничения к этой роли не применяются.
                </div>
              ) : (
                <>
                  <div className="mt-6 space-y-5">
                    {groupedPermissions.map(([section, items]) => (
                      <div key={section}>
                        <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500">
                          {section}
                        </h3>

                        <div className="mt-2 space-y-2">
                          {items.map((permission) => {
                            const roleDefault = roleDefaultAllowed(
                              selectedUser.role,
                              permission.permission_key
                            );
                            const override =
                              permissionDraft[permission.permission_key];
                            const effective = effectivePermission(
                              permission.permission_key
                            );

                            return (
                              <div
                                key={permission.permission_key}
                                className="rounded-lg border border-zinc-800 bg-zinc-950 p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold">
                                      {permission.label}
                                    </p>
                                    <p className="mt-1 text-xs text-zinc-600">
                                      По роли: {roleDefault ? "разрешено" : "запрещено"}
                                    </p>
                                  </div>

                                  <div className="flex shrink-0 gap-1">
                                    <PermissionButton
                                      active={override === null}
                                      title="По роли"
                                      onClick={() =>
                                        setPermissionDraft((current) => ({
                                          ...current,
                                          [permission.permission_key]: null,
                                        }))
                                      }
                                    >
                                      Роль
                                    </PermissionButton>

                                    <PermissionButton
                                      active={override === true}
                                      title="Разрешить"
                                      onClick={() =>
                                        setPermissionDraft((current) => ({
                                          ...current,
                                          [permission.permission_key]: true,
                                        }))
                                      }
                                    >
                                      <Check size={14} />
                                    </PermissionButton>

                                    <PermissionButton
                                      active={override === false}
                                      title="Запретить"
                                      onClick={() =>
                                        setPermissionDraft((current) => ({
                                          ...current,
                                          [permission.permission_key]: false,
                                        }))
                                      }
                                    >
                                      <X size={14} />
                                    </PermissionButton>
                                  </div>
                                </div>

                                <p
                                  className={`mt-2 text-xs font-semibold ${
                                    effective ? "text-green-400" : "text-red-400"
                                  }`}
                                >
                                  Итог: {effective ? "разрешено" : "запрещено"}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={savePermissions}
                    disabled={savingPermissions}
                    className="mt-6 w-full rounded-lg bg-green-500 px-4 py-3 font-bold text-black hover:bg-green-400 disabled:opacity-50"
                  >
                    {savingPermissions
                      ? "Сохраняем..."
                      : "Сохранить индивидуальные права"}
                  </button>
                </>
              )}
            </>
          )}
        </section>
      </div>

      {createOpen && (
        <Modal title="Новый сотрудник" onClose={() => setCreateOpen(false)}>
          <form onSubmit={createUser} className="space-y-4">
            <input
              value={createForm.full_name}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  full_name: event.target.value,
                }))
              }
              placeholder="Имя сотрудника"
              className="w-full rounded-lg bg-zinc-950 p-3"
              required
            />

            <input
              type="email"
              value={createForm.email}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="Email"
              className="w-full rounded-lg bg-zinc-950 p-3"
              required
            />

            <div className="relative">
              <KeyRound
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
              />
              <input
                type="password"
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="Пароль, минимум 8 символов"
                className="w-full rounded-lg bg-zinc-950 py-3 pl-10 pr-3"
                required
                minLength={8}
              />
            </div>

            <select
              value={createForm.role}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  role: event.target.value as UserRole,
                }))
              }
              className="w-full rounded-lg bg-zinc-950 p-3"
            >
              {roleOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <button
              disabled={savingUser}
              className="w-full rounded-lg bg-green-500 px-4 py-3 font-bold text-black disabled:opacity-50"
            >
              {savingUser ? "Создаём..." : "Создать сотрудника"}
            </button>
          </form>
        </Modal>
      )}

      {editOpen && (
        <Modal title="Изменить сотрудника" onClose={() => setEditOpen(false)}>
          <form onSubmit={updateUser} className="space-y-4">
            <input
              value={editForm.full_name}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  full_name: event.target.value,
                }))
              }
              placeholder="Имя сотрудника"
              className="w-full rounded-lg bg-zinc-950 p-3"
              required
            />

            <select
              value={editForm.role}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  role: event.target.value as UserRole,
                }))
              }
              className="w-full rounded-lg bg-zinc-950 p-3"
            >
              {roleOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-3 rounded-lg bg-zinc-950 p-3">
              <input
                type="checkbox"
                checked={editForm.is_active}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    is_active: event.target.checked,
                  }))
                }
              />
              <span className="text-sm">Аккаунт активен</span>
            </label>

            <button
              disabled={savingUser}
              className="w-full rounded-lg bg-green-500 px-4 py-3 font-bold text-black disabled:opacity-50"
            >
              {savingUser ? "Сохраняем..." : "Сохранить"}
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}

function PermissionButton({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex min-h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-bold ${
        active
          ? "bg-green-500 text-black"
          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-green-400">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}