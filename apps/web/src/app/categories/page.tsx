'use client';

import { useEffect, useState } from 'react';
import { Category, CategoryType } from '@financer/shared';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

const defaultColors = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

export default function CategoriesPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'expense' as CategoryType,
    color: defaultColors[0],
    parentId: undefined as number | undefined,
  });

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      const data = await api.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({ name: '', type: 'expense', color: defaultColors[0], parentId: undefined });
    setEditingId(null);
    setShowForm(false);
  }

  function handleEdit(category: Category) {
    setFormData({
      name: category.name,
      type: category.type,
      color: category.color || defaultColors[0],
      parentId: category.parentId,
    });
    setEditingId(category.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        color: formData.color,
        parentId: formData.parentId,
      };

      if (editingId) {
        await api.updateCategory(editingId, payload);
      } else {
        await api.createCategory(payload);
      }

      resetForm();
      loadCategories();
    } catch (error) {
      console.error('Failed to save category:', error);
    }
  }

  // Get parent categories (categories without a parent)
  const parentCategories = categories.filter(c => !c.parentId);

  // Helper to get subcategories for a parent
  const getSubcategories = (parentId: number) => categories.filter(c => c.parentId === parentId);

  // Quick add subcategory - opens form with parent pre-selected
  function handleAddSubcategory(parent: Category) {
    setFormData({
      name: '',
      type: parent.type,
      color: parent.color || defaultColors[0],
      parentId: parent.id,
    });
    setEditingId(null);
    setShowForm(true);
  }

  async function handleDelete(id: number) {
    if (!confirm(t('categoriesConfirmDelete'))) return;

    try {
      await api.deleteCategory(id);
      loadCategories();
    } catch (error: any) {
      alert(error.message || t('categoriesDeleteFailed'));
    }
  }

  // Get root categories (without parent) by type
  const incomeRootCategories = categories.filter(c => c.type === 'income' && !c.parentId);
  const expenseRootCategories = categories.filter(c => c.type === 'expense' && !c.parentId);

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('categoriesTitle')}</h1>
          <button
            onClick={() => {
              if (showForm) resetForm();
              else setShowForm(true);
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            {showForm ? t('cancel') : t('categoriesNewCategory')}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
            <h2 className="font-semibold">{editingId ? t('categoriesEditCategory') : t('categoriesNewCategoryTitle')}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('categoriesName')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t('categoriesNamePlaceholder')}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('categoriesType')}</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as CategoryType, parentId: undefined })}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="expense">{t('typeExpense')}</option>
                  <option value="income">{t('typeIncome')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('categoriesParent')}</label>
                <select
                  value={formData.parentId || ''}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">{t('categoriesNoParent')}</option>
                  {parentCategories
                    .filter(c => c.type === formData.type && c.id !== editingId)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('categoriesColor')}</label>
                <div className="flex gap-2 flex-wrap">
                  {defaultColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.color === color ? 'border-foreground scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              {editingId ? t('update') : t('create')}
            </button>
          </form>
        )}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Expense Categories */}
            <div>
              <h2 className="font-semibold mb-4 text-expense">{t('dashboardExpenses')}</h2>
              {expenseRootCategories.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('categoriesNoExpenseCategories')}</p>
              ) : (
                <div className="space-y-2">
                  {expenseRootCategories.map((cat) => (
                    <div key={cat.id}>
                      {/* Parent Category */}
                      <div className="glass-card p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: cat.color || '#6b7280' }}
                          />
                          <span className="font-medium">{cat.name}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleAddSubcategory(cat)}
                            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-sm text-primary hover:text-primary/80 hover:bg-primary/10 rounded-md transition-colors"
                            title={t('categoriesAddSubcategory')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleEdit(cat)}
                            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-sm text-muted-foreground hover:text-foreground hover:bg-background rounded-md transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(cat.id)}
                            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {/* Subcategories */}
                      {getSubcategories(cat.id).map((sub) => (
                        <div
                          key={sub.id}
                          className="glass-card p-4 flex items-center justify-between ml-6 mt-1 border-l-2"
                          style={{ borderColor: cat.color || '#6b7280' }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: sub.color || cat.color || '#6b7280' }}
                            />
                            <span className="text-sm">{sub.name}</span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEdit(sub)}
                              className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-background rounded-md transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(sub.id)}
                              className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Income Categories */}
            <div>
              <h2 className="font-semibold mb-4 text-income">{t('dashboardIncome')}</h2>
              {incomeRootCategories.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('categoriesNoIncomeCategories')}</p>
              ) : (
                <div className="space-y-2">
                  {incomeRootCategories.map((cat) => (
                    <div key={cat.id}>
                      {/* Parent Category */}
                      <div className="glass-card p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: cat.color || '#6b7280' }}
                          />
                          <span className="font-medium">{cat.name}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleAddSubcategory(cat)}
                            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-sm text-primary hover:text-primary/80 hover:bg-primary/10 rounded-md transition-colors"
                            title={t('categoriesAddSubcategory')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleEdit(cat)}
                            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-sm text-muted-foreground hover:text-foreground hover:bg-background rounded-md transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(cat.id)}
                            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {/* Subcategories */}
                      {getSubcategories(cat.id).map((sub) => (
                        <div
                          key={sub.id}
                          className="glass-card p-4 flex items-center justify-between ml-6 mt-1 border-l-2"
                          style={{ borderColor: cat.color || '#6b7280' }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: sub.color || cat.color || '#6b7280' }}
                            />
                            <span className="text-sm">{sub.name}</span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEdit(sub)}
                              className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-background rounded-md transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(sub.id)}
                              className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
