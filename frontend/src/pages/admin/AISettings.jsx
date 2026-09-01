import { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertCircle, CheckCircle, Cpu, Save, Settings, Sparkles } from 'lucide-react';
import API_URL from '../../config/api';

const MODEL_GROUPS = [
  {
    group: '🦙 Meta Llama Models',
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Meta Llama 3.3 70B Instruct', badge: 'Recommended', desc: 'Meta’s flagship 70B model with 128k context & strong instruction following.' },
      { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Meta Llama 3.1 405B Instruct', badge: 'Ultra-Powerful', desc: 'Meta’s largest 405B parameter model for complex academic reasoning.' },
      { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Meta Llama 3.1 70B Instruct', badge: 'Popular', desc: 'Proven 70B open-weights model for accurate quizzes and lesson content.' },
      { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Meta Llama 3.1 8B Instruct', badge: 'Fast & Cheap', desc: 'Lightweight, high-speed 8B model ideal for fast generation.' },
      { id: 'meta-llama/llama-3.2-3b-instruct', name: 'Meta Llama 3.2 3B Instruct', badge: 'Lightweight', desc: 'Compact 3B model for quick draft generations.' },
      { id: 'meta-llama/llama-3.2-11b-vision-instruct', name: 'Meta Llama 3.2 11B Vision', badge: 'Multimodal', desc: 'Meta Llama model with vision and multimodal capabilities.' },
    ],
  },
  {
    group: '🤖 OpenAI Models',
    models: [
      { id: 'openai/gpt-4o-mini', name: 'OpenAI GPT-4o Mini', badge: 'Fast', desc: 'Lightweight, fast OpenAI model for high throughput.' },
      { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o', badge: 'High Accuracy', desc: 'OpenAI flagship model with strong reasoning capability.' },
      { id: 'openai/gpt-4-turbo', name: 'OpenAI GPT-4 Turbo', badge: 'Legacy', desc: 'GPT-4 Turbo model.' },
    ],
  },
  {
    group: '🌐 Google Gemini Models',
    models: [
      { id: 'google/gemini-2.0-flash-001', name: 'Google Gemini 2.0 Flash', badge: 'Next-Gen Speed', desc: 'Google’s next-generation fast multimodal Flash model.' },
      { id: 'google/gemini-flash-1.5', name: 'Google Gemini 1.5 Flash', badge: 'Fast', desc: 'High-speed Gemini Flash 1.5 model.' },
      { id: 'google/gemini-pro-1.5', name: 'Google Gemini 1.5 Pro', badge: 'Deep Reasoning', desc: 'Long-context Gemini 1.5 Pro model.' },
    ],
  },
  {
    group: '🟣 Anthropic Claude Models',
    models: [
      { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic Claude 3.5 Sonnet', badge: 'Top Instruction', desc: 'Premier Claude model for structured instruction following.' },
      { id: 'anthropic/claude-3-haiku', name: 'Anthropic Claude 3 Haiku', badge: 'Fast', desc: 'Fast, cost-effective Claude 3 model.' },
    ],
  },
  {
    group: '🐋 DeepSeek Models',
    models: [
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', badge: 'Reasoning', desc: 'DeepSeek R1 reasoning model.' },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 (Chat)', badge: 'High Efficiency', desc: 'DeepSeek V3 conversational model.' },
    ],
  },
];

const ALL_PRESET_IDS = new Set(MODEL_GROUPS.flatMap(g => g.models.map(m => m.id)));

const FEATURED_LLAMA_MODELS = [
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Meta Llama 3.3 70B', tag: 'Recommended' },
  { id: 'meta-llama/llama-3.1-70b-instruct', label: 'Meta Llama 3.1 70B', tag: 'High Speed' },
  { id: 'meta-llama/llama-3.1-8b-instruct', label: 'Meta Llama 3.1 8B', tag: 'Low Cost' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', tag: 'OpenAI' },
  { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash', tag: 'Google' },
];

export default function AISettings() {
  const [form, setForm] = useState({ model: 'openai/gpt-4o-mini', daily_teacher_limit: 10, is_enabled: true });
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    axios.get(`${API_URL}/ai/admin/settings`)
      .then(response => {
        const loadedModel = response.data.settings.model || 'openai/gpt-4o-mini';
        setForm({
          model: loadedModel,
          daily_teacher_limit: response.data.settings.daily_teacher_limit,
          is_enabled: response.data.settings.is_enabled,
        });
        setIsCustomMode(!ALL_PRESET_IDS.has(loadedModel));
        setApiKeyConfigured(response.data.settings.api_key_configured);
      })
      .catch(error => setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to load EduMan AI settings.' }))
      .finally(() => setLoading(false));
  }, []);

  const handleSelectChange = (e) => {
    const val = e.target.value;
    if (val === 'custom') {
      setIsCustomMode(true);
    } else {
      setIsCustomMode(false);
      setForm({ ...form, model: val });
    }
  };

  const selectQuickModel = (modelId) => {
    setIsCustomMode(false);
    setForm({ ...form, model: modelId });
  };

  const save = async event => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await axios.put(`${API_URL}/ai/admin/settings`, form);
      setForm(response.data.settings);
      setIsCustomMode(!ALL_PRESET_IDS.has(response.data.settings.model));
      setMessage({ type: 'success', text: response.data.message });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to save EduMan AI settings.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading EduMan AI settings...</div>;

  const currentSelectValue = isCustomMode ? 'custom' : (ALL_PRESET_IDS.has(form.model) ? form.model : 'custom');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs">
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900"><Settings className="h-5 w-5 text-violet-600" /> EduMan AI Settings</h2>
        <p className="mt-1 text-xs sm:text-sm text-gray-500">Configure the AI model provider (including Meta Llama models) and school-level teacher usage policy.</p>
      </div>

      {message.text && (
        <div className={`flex items-center rounded-xl border p-4 text-xs sm:text-sm ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          {message.type === 'error' ? <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" /> : <CheckCircle className="mr-2 h-5 w-5 flex-shrink-0" />}{message.text}
        </div>
      )}

      <div className={`rounded-xl border p-4 text-xs sm:text-sm ${apiKeyConfigured ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
        OpenRouter API key: <strong>{apiKeyConfigured ? 'configured on the backend' : 'not configured'}</strong>. The key is never returned to this page.
      </div>

      <form onSubmit={save} className="space-y-6 rounded-2xl border border-gray-100 bg-white p-4 sm:p-6 shadow-xs">
        {/* Quick selection chips */}
        <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-violet-900 uppercase tracking-wider">
            <Sparkles className="h-4 w-4 text-violet-600" /> Quick Select Featured Models
          </div>
          <div className="flex flex-wrap gap-2">
            {FEATURED_LLAMA_MODELS.map(m => {
              const isSelected = form.model === m.id && !isCustomMode;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectQuickModel(m.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                    isSelected
                      ? 'border-violet-600 bg-violet-600 text-white shadow-xs'
                      : 'border-violet-200 bg-white text-violet-800 hover:border-violet-400 hover:bg-violet-50'
                  }`}
                >
                  <Cpu className="h-3.5 w-3.5" />
                  <span>{m.label}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700'
                  }`}>
                    {m.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Model Dropdown Selector */}
        <div className="space-y-2">
          <label className="block text-xs sm:text-sm font-medium text-gray-700">
            OpenRouter AI Model
            <select
              value={currentSelectValue}
              onChange={handleSelectChange}
              className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white p-3 text-xs sm:text-sm text-gray-900 font-medium focus:border-violet-500 focus:ring-2 focus:ring-violet-500"
            >
              {MODEL_GROUPS.map(group => (
                <optgroup key={group.group} label={group.group}>
                  {group.models.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.badge}) — {m.id}
                    </option>
                  ))}
                </optgroup>
              ))}
              <optgroup label="⚙️ Custom Configuration">
                <option value="custom">Enter Custom OpenRouter Model Slug...</option>
              </optgroup>
            </select>
          </label>

          {/* Custom Slug Text Input if custom mode selected */}
          {isCustomMode && (
            <div className="pt-2 animate-in fade-in duration-200">
              <label className="block text-xs font-semibold text-violet-700">
                Custom Model Slug
                <input
                  required
                  type="text"
                  value={form.model}
                  onChange={e => setForm({ ...form, model: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-violet-300 p-2.5 text-xs sm:text-sm font-mono text-gray-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-500"
                  placeholder="e.g. meta-llama/llama-3.3-70b-instruct or mistralai/mistral-large"
                />
              </label>
              <span className="mt-1 block text-[11px] text-gray-500">Specify any valid OpenRouter model slug that supports JSON schema structured outputs.</span>
            </div>
          )}

          {/* Selected Model Details & Meta Llama Indicator */}
          {!isCustomMode && (
            <div className="mt-2 rounded-xl bg-gray-50 p-3 border border-gray-200/80 text-xs text-gray-600 flex items-start gap-2">
              <Cpu className="h-4 w-4 text-violet-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-gray-900">{form.model}</span>
                {form.model.startsWith('meta-llama/') && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                    🦙 Meta Llama Family
                  </span>
                )}
                <p className="mt-0.5 text-gray-500">
                  {MODEL_GROUPS.flatMap(g => g.models).find(m => m.id === form.model)?.desc || 'Ready for curriculum assessment & content generation.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Daily Generation Limit */}
        <label className="block text-xs sm:text-sm font-medium text-gray-700">
          Daily generation limit per teacher
          <input
            type="number"
            min="1"
            max="500"
            required
            value={form.daily_teacher_limit}
            onChange={event => setForm({ ...form, daily_teacher_limit: Number(event.target.value) })}
            className="mt-1.5 w-full rounded-xl border border-gray-300 p-2.5 text-xs sm:text-sm text-gray-900"
          />
          <span className="mt-1 block text-[11px] text-gray-400">Maximum AI generations allowed per teacher each 24-hour period.</span>
        </label>

        {/* Enable EduMan AI Toggle */}
        <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-4 transition-colors hover:bg-gray-50/50">
          <input
            type="checkbox"
            checked={form.is_enabled}
            onChange={event => setForm({ ...form, is_enabled: event.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
          />
          <span>
            <strong className="block text-xs sm:text-sm text-gray-900">Enable EduMan AI generation</strong>
            <span className="text-xs text-gray-500">When disabled, teachers can still view and manage saved drafts and published resources.</span>
          </span>
        </label>

        <button
          disabled={saving}
          className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60 transition shadow-xs"
        >
          <Save className="mr-2 h-4 w-4" /> {saving ? 'Saving…' : 'Save EduMan AI Settings'}
        </button>
      </form>
    </div>
  );
}
