import React, { useState } from 'react';
import { LogIn, Key } from 'lucide-react';
import { setAuthToken } from '../tasklet-shim';
import { changePin } from '../utils/db';

interface LoginScreenProps {
  onLogin: (user: { id: number; name: string; role: string; phone?: string }) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHint, setShowHint] = useState(true);

  // PIN change flow
  const [changePinMode, setChangePinMode] = useState(false);
  const [pendingUser, setPendingUser] = useState<{id: number; name: string; role: string; phone?: string} | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !pin.trim()) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), pin: pin.trim() }),
      });

      if (!response.ok) {
        setError('用户名或密码错误');
        setLoading(false);
        return;
      }

      const data = await response.json();
      // Store JWT token in the shim — all subsequent API calls will use it
      setAuthToken(data.token);

      const user = data.user;
      if (user.must_change_pin) {
        // Force PIN change before proceeding
        setPendingUser({ id: user.id, name: user.name, role: user.role, phone: user.phone });
        setChangePinMode(true);
        setPin('');
      } else {
        onLogin({ id: user.id, name: user.name, role: user.role, phone: user.phone });
      }
    } catch (err) {
      setError('登录失败，请重试');
      console.error(err);
    }
    setLoading(false);
  }

  async function handleChangePin(e: React.FormEvent) {
    e.preventDefault();
    setPinError('');
    if (!newPin.trim() || newPin.length < 4) {
      setPinError('密码至少 4 位');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('两次输入的 PIN 不一致');
      return;
    }
    if (!pendingUser) return;
    setPinSaving(true);
    try {
      // changePin uses window.tasklet.sqlExec (via shim) — JWT is already set
      await changePin(pendingUser.id, newPin);
      onLogin(pendingUser);
    } catch (err) {
      setPinError('修改失败，请重试');
      console.error(err);
    }
    setPinSaving(false);
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-base-200">
      <div className="card w-full max-w-sm bg-base-100 shadow-xl mx-4">
        <div className="card-body items-center text-center">
          {/* Logo / Brand */}
          <div className="mb-2">
            <h1 className="text-3xl font-bold tracking-widest mt-2">
              <span className="text-primary">V</span><span className="text-accent">E</span><span className="text-secondary">NCOS</span>
            </h1>
            <p className="text-xs text-base-content/50 mt-1 tracking-wider">PROPERTY MANAGEMENT</p>
          </div>

          {!changePinMode ? (
            /* Login Form */
            <form onSubmit={handleSubmit} className="w-full space-y-3 mt-4">
              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-xs">用户名 / 手机号</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  placeholder="输入用户名或手机号"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(''); setShowHint(false); }}
                  autoFocus
                />
              </div>

              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-xs">密码</span>
                </label>
                <input
                  type="password"
                  className="input input-bordered input-sm w-full"
                  placeholder="输入密码"
                  value={pin}
                  onChange={(e) => { setPin(e.target.value); setError(''); setShowHint(false); }}
                />
              </div>

              {error && (
                <div className="text-error text-xs text-center py-1">{error}</div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-sm w-full gap-2 mt-2"
                disabled={loading}
              >
                {loading ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <LogIn size={14} />
                )}
                登录
              </button>
            </form>
          ) : (
            /* PIN Change Form */
            <form onSubmit={handleChangePin} className="w-full space-y-3 mt-4">
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                <p className="text-xs text-warning font-medium flex items-center gap-1.5">
                  <Key size={13} /> 首次登录，请修改您的密码
                </p>
                <p className="text-xs text-base-content/50 mt-1">
                  欢迎，{pendingUser?.name}！为了账户安全，请设置新的密码。
                </p>
              </div>

              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-xs">新 PIN 密码</span>
                </label>
                <input
                  type="password"
                  className="input input-bordered input-sm w-full"
                  placeholder="至少4位，支持数字和字母" 
                  value={newPin}
                  onChange={(e) => { setNewPin(e.target.value); setPinError(''); }}
                  autoFocus
                />
              </div>

              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-xs">确认新 PIN</span>
                </label>
                <input
                  type="password"
                  className="input input-bordered input-sm w-full"
                  placeholder="再次输入新密码" 
                  value={confirmPin}
                  onChange={(e) => { setConfirmPin(e.target.value); setPinError(''); }}
                />
              </div>

              {pinError && (
                <div className="text-error text-xs text-center py-1">{pinError}</div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-sm w-full gap-2 mt-2"
                disabled={pinSaving}
              >
                {pinSaving ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <Key size={14} />
                )}
                设置新密码并登录
              </button>

              <button type="button" className="btn btn-ghost btn-xs w-full" onClick={() => {
                setChangePinMode(false);
                setPendingUser(null);
                setNewPin('');
                setConfirmPin('');
              }}>
                返回登录
              </button>
            </form>
          )}

          {/* Default credentials hint */}
          {showHint && !changePinMode && (
            <div className="mt-4 text-xs text-base-content/40">
              默认账户: admin / 1234
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
