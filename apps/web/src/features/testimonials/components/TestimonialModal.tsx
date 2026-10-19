'use client';

import { useState, useEffect, useRef } from 'react';
import { TestimonialRecord } from '@/lib/api';
import { useSession } from '@/hooks/use-session';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Youtube,
  Image as ImageIcon,
  Loader2,
  Edit3,
  ShieldCheck,
} from 'lucide-react';
import { RatingDisplay } from '@/features/shared/rating-display';
import { cn } from '@/lib/utils';
import { listCategories, listTags } from '@/features/catalog/api';
import { PageControls } from '@/features/shared/pagination';
import {
  attachTestimonialImage,
  attachTestimonialVideo,
  transitionTestimonial,
  updateTestimonial,
  type TestimonialTransition,
} from '../api';
import { useDialogFocus } from '@/features/shared/use-dialog-focus';
import { DiscardChangesDialog } from './discard-changes-dialog';
import {
  testimonialStatusLabels,
  testimonialStatusHelp,
} from '../presentation';
import { useActionConfirmation } from '@/features/shared/use-action-confirmation';
import { deleteTestimonial } from '../api';
import { actionFailureCopy } from '@/features/shared/load-failure';

interface TestimonialModalProps {
  testimonial: TestimonialRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (testimonial: TestimonialRecord) => void;
  onDeleted?: () => void;
  navigation?: {
    previous: () => void;
    next: () => void;
    canPrevious: boolean;
    canNext: boolean;
    busy: boolean;
    description: string;
    error: string | null;
  };
}

export function TestimonialModal({
  testimonial,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
  navigation,
}: TestimonialModalProps) {
  const { fetchApi, session } = useSession();
  const focus = useDialogFocus();
  const confirmation = useActionConfirmation();
  const roles = session?.user.roles ?? [];
  const canModerate = roles.includes('admin') || roles.includes('editor');
  const isPublished = testimonial?.status === 'published';
  const canEdit =
    canModerate &&
    !isPublished &&
    (roles.includes('admin') ||
      Boolean(
        session?.user.id && testimonial?.createdById === session.user.id,
      ));
  const canAttach = canModerate && !isPublished;
  const mutationLock = useRef(false);
  const [pending, setPending] = useState<
    'status' | 'edit' | 'image' | 'video' | 'delete' | null
  >(null);
  const busy = pending !== null;
  const loadingVideo = pending === 'video';
  const loadingImage = pending === 'image';
  const [videoUrl, setVideoUrl] = useState('');
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [metaError, setMetaError] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaRevision, setMetaRevision] = useState(0);
  const [discardTarget, setDiscardTarget] = useState<
    'close' | 'edit' | 'reject' | null
  >(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [editTagIds, setEditTagIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [allTags, setAllTags] = useState<{ id: string; name: string }[]>([]);
  const [categoryPage, setCategoryPage] = useState(1);
  const [tagPage, setTagPage] = useState(1);
  const [categoryTotal, setCategoryTotal] = useState(0);
  const [tagTotal, setTagTotal] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadMeta() {
      if (!open || !isEditing) return;
      setMetaError(false);
      setMetaLoading(true);
      try {
        const [catRes, tagRes] = await Promise.all([
          listCategories(fetchApi, categoryPage, 20),
          listTags(fetchApi, tagPage, 20),
        ]);
        if (!active) return;
        setCategories((previous) => {
          const selected =
            previous.find((item) => item.id === editCategoryId) ??
            (testimonial?.category?.id === editCategoryId
              ? testimonial.category
              : undefined);
          return [
            ...(selected &&
            !catRes.data.items.some((item) => item.id === selected.id)
              ? [selected]
              : []),
            ...catRes.data.items,
          ];
        });
        setAllTags((previous) => {
          const selected = editTagIds
            .map(
              (id) =>
                previous.find((item) => item.id === id) ??
                testimonial?.tags?.find((item) => item.id === id),
            )
            .filter((item): item is { id: string; name: string } =>
              Boolean(item),
            );
          return [
            ...selected.filter(
              (item) => !tagRes.data.items.some((next) => next.id === item.id),
            ),
            ...tagRes.data.items,
          ];
        });
        setCategoryTotal(catRes.data.meta.total);
        setTagTotal(tagRes.data.meta.total);
      } catch {
        if (active) setMetaError(true);
      } finally {
        if (active) setMetaLoading(false);
      }
    }
    void loadMeta();
    return () => {
      active = false;
    };
  }, [
    open,
    isEditing,
    fetchApi,
    categoryPage,
    tagPage,
    editCategoryId,
    editTagIds,
    testimonial,
    metaRevision,
  ]);

  useEffect(() => {
    if (open && testimonial) {
      setRejectMode(false);
      setRejectReason('');
      setVideoUrl('');
      setActionError(null);
      setIsEditing(false);
      setDiscardTarget(null);
      setEditContent(testimonial.content);
      setEditAuthor(testimonial.authorName);
      setEditCategoryId(testimonial.categoryId || null);
      setEditTagIds(testimonial.tags?.map((t) => t.id) || []);
      setCategoryPage(1);
      setTagPage(1);
      setCategories(testimonial.category ? [testimonial.category] : []);
      setAllTags(testimonial.tags ?? []);
    }
  }, [open, testimonial]);

  // Success belongs to this opening, and survives the confirmed record refresh.
  useEffect(() => {
    setActionSuccess(null);
  }, [open, testimonial?.id]);

  if (!testimonial) return null;
  const editDirty =
    isEditing &&
    (editContent !== testimonial.content ||
      editAuthor !== testimonial.authorName ||
      editCategoryId !== (testimonial.categoryId || null) ||
      editTagIds.length !== (testimonial.tags?.length ?? 0) ||
      editTagIds.some((id) => !testimonial.tags?.some((tag) => tag.id === id)));
  const dirty = editDirty || Boolean(rejectReason || videoUrl);

  function requestClose(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (mutationLock.current) return;
    if (dirty) {
      setDiscardTarget('close');
      return;
    }
    onOpenChange(false);
  }

  function cancelEdits() {
    if (mutationLock.current) return;
    if (editDirty) {
      setDiscardTarget('edit');
      return;
    }
    setIsEditing(false);
  }

  function discardChanges() {
    if (discardTarget === 'close') onOpenChange(false);
    if (discardTarget === 'edit') {
      setEditAuthor(testimonial!.authorName);
      setEditContent(testimonial!.content);
      setEditCategoryId(testimonial!.categoryId || null);
      setEditTagIds(testimonial!.tags?.map((tag) => tag.id) ?? []);
      setIsEditing(false);
    }
    if (discardTarget === 'reject') {
      setRejectReason('');
      setRejectMode(false);
    }
    setDiscardTarget(null);
  }

  async function mutate(
    kind: NonNullable<typeof pending>,
    operation: () => Promise<{ data: TestimonialRecord }>,
    task: string,
    success: string,
  ) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setPending(kind);
    setActionError(null);
    setActionSuccess(null);
    try {
      const response = await operation();
      onUpdated(response.data);
      setActionSuccess(success);
      if (kind === 'status') {
        setRejectMode(false);
        setRejectReason('');
      }
      if (kind === 'edit') setIsEditing(false);
      if (kind === 'video') setVideoUrl('');
    } catch (error) {
      setActionError(actionFailureCopy(error, task));
    } finally {
      mutationLock.current = false;
      setPending(null);
    }
  }

  async function handleStatusChange(
    action: TestimonialTransition,
    body?: { reason: string },
  ) {
    if (
      !testimonial ||
      !canModerate ||
      isEditing ||
      videoUrl ||
      (rejectMode && action !== 'reject')
    )
      return;
    const messages = {
      submit: 'Testimonio enviado a revisión.',
      approve: 'Testimonio aprobado. Todavía no es público.',
      publish: 'Testimonio publicado.',
      reject: isPublished
        ? 'Testimonio ocultado y rechazado.'
        : 'Testimonio rechazado.',
    };
    await mutate(
      'status',
      () => transitionTestimonial(fetchApi, testimonial.id, action, body),
      'la moderación del testimonio',
      messages[action],
    );
  }

  async function handleVideoSubmit() {
    if (
      !videoUrl.trim() ||
      !testimonial ||
      !canAttach ||
      isEditing ||
      rejectMode
    )
      return;
    await mutate(
      'video',
      () => attachTestimonialVideo(fetchApi, testimonial.id, videoUrl),
      'la asociación del video',
      'Video vinculado.',
    );
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !testimonial || !canAttach || isEditing || rejectMode) return;
    if (file.size > 10 * 1024 * 1024) {
      setActionError(
        'La imagen supera el máximo de 10 MB. Elegí una más pequeña.',
      );
      return;
    }
    await mutate(
      'image',
      async () => {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            typeof reader.result === 'string'
              ? resolve(reader.result)
              : reject(new Error('image read failed'));
          reader.onerror = () => reject(new Error('image read failed'));
          reader.onabort = () => reject(new Error('image read aborted'));
          reader.readAsDataURL(file);
        });
        return attachTestimonialImage(fetchApi, testimonial.id, base64);
      },
      'la subida de la imagen',
      'Imagen adjuntada.',
    );
  }

  async function handleSaveEdits() {
    if (!testimonial || !canEdit) return;
    if (!editCategoryId && testimonial.categoryId) {
      setActionError(
        'La API todavía no permite quitar una categoría asignada. Elegí otra categoría para continuar.',
      );
      return;
    }
    await mutate(
      'edit',
      () =>
        updateTestimonial(fetchApi, testimonial.id, {
          authorName: editAuthor,
          content: editContent,
          ...(editCategoryId && { categoryId: editCategoryId }),
          tagIds: editTagIds,
        }),
      'la edición del testimonio',
      'Cambios guardados.',
    );
  }

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent
        {...focus}
        className="flex max-h-[95dvh] max-w-2xl flex-col gap-0 p-0 overflow-hidden border-0 bg-background rounded-none shadow-2xl"
      >
        <DialogTitle className="sr-only">
          Testimonio de {testimonial.authorName}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Detalle, moderación y multimedia del testimonio
        </DialogDescription>
        {navigation && (
          <nav
            aria-label="Revisión contextual"
            className="shrink-0 space-y-3 border-b px-6 pb-4 pt-6 pr-14 font-body text-sm"
          >
            <p>{navigation.description}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={
                  !navigation.canPrevious || busy || dirty || navigation.busy
                }
                onClick={navigation.previous}
              >
                Testimonio anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={
                  !navigation.canNext || busy || dirty || navigation.busy
                }
                onClick={navigation.next}
              >
                Testimonio siguiente
              </Button>
            </div>
            {dirty && (
              <p className="text-muted-foreground">
                Guardá o descartá tus cambios antes de revisar otro testimonio.
              </p>
            )}
            {navigation.busy && (
              <p role="status">Buscando el siguiente resultado…</p>
            )}
            {navigation.error && <p role="alert">{navigation.error}</p>}
          </nav>
        )}
        <fieldset
          disabled={busy}
          aria-busy={busy}
          className={cn(
            'flex min-h-0 min-w-0 flex-col overflow-y-auto md:flex-row md:overflow-hidden',
            navigation ? 'max-h-[70dvh]' : 'max-h-[90dvh]',
          )}
        >
          {/* Left Column: Visual & Content (Neo-Editorial) */}
          <div className="relative shrink-0 bg-card p-8 border-b md:min-w-0 md:flex-1 md:overflow-y-auto md:border-b-0 md:border-r md:p-12">
            <div className="absolute top-0 left-0 w-full h-1 bg-primary/20" />
            {actionError && (
              <p
                role="alert"
                className="mb-6 border border-destructive p-3 font-body text-sm"
              >
                {actionError}
              </p>
            )}
            {metaError && isEditing && (
              <p
                role="alert"
                className="mb-6 border border-destructive p-3 font-body text-sm"
              >
                No se pudieron cargar las categorías y etiquetas. Tus cambios se
                conservan.
                <Button
                  type="button"
                  variant="outline"
                  disabled={metaLoading}
                  onClick={() => setMetaRevision((value) => value + 1)}
                  className="mt-2"
                >
                  Reintentar categorías y etiquetas
                </Button>
              </p>
            )}
            {actionSuccess && (
              <p role="status" className="mb-6 font-body text-sm">
                {actionSuccess}
              </p>
            )}

            <div className="flex items-center justify-between mb-8">
              <span className="font-body text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/20 px-2 py-1">
                {testimonial.id.split('-')[0]}
              </span>

              {canEdit && !isEditing && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={rejectMode || Boolean(videoUrl)}
                  onClick={() => setIsEditing(true)}
                  className="h-8 font-body text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  <Edit3 className="w-3 h-3 mr-2" /> Editar Testimonio
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {testimonial.category && (
                <span className="font-body text-[10px] font-bold uppercase tracking-widest text-background bg-primary px-2 py-1">
                  {testimonial.category.name}
                </span>
              )}
              {testimonial.tags?.map((tag) => (
                <span
                  key={tag.id}
                  className="font-body text-[10px] font-bold uppercase tracking-widest text-foreground border border-border px-2 py-1"
                >
                  #{tag.name}
                </span>
              ))}
            </div>

            {isEditing ? (
              <div className="space-y-6 animate-fade-in-up">
                <div>
                  <Label
                    htmlFor="edit-testimonial-author"
                    className="font-body text-xs font-bold uppercase tracking-widest text-muted-foreground"
                  >
                    Autor
                  </Label>
                  <Input
                    id="edit-testimonial-author"
                    minLength={2}
                    maxLength={120}
                    value={editAuthor}
                    onChange={(e) => setEditAuthor(e.target.value)}
                    className="mt-2 font-body text-base bg-background rounded-none border-t-0 border-x-0 border-b-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary px-0"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="edit-testimonial-content"
                    className="font-body text-xs font-bold uppercase tracking-widest text-muted-foreground"
                  >
                    Contenido
                  </Label>
                  <textarea
                    id="edit-testimonial-content"
                    minLength={10}
                    maxLength={1000}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full mt-2 bg-background font-body text-base leading-relaxed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring resize-y min-h-[150px] border-b-2 border-border focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label
                      htmlFor="edit-testimonial-category"
                      className="font-body text-xs font-bold uppercase tracking-widest text-muted-foreground"
                    >
                      Categoría
                    </Label>
                    <select
                      id="edit-testimonial-category"
                      value={editCategoryId || ''}
                      onChange={(e) =>
                        setEditCategoryId(e.target.value || null)
                      }
                      className="w-full mt-2 bg-background border-b-2 border-border p-2 font-body text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus:border-primary"
                    >
                      <option value="">Sin Categoría</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <PageControls
                      page={categoryPage}
                      total={categoryTotal}
                      limit={20}
                      onChange={setCategoryPage}
                    />
                  </div>
                  <div>
                    <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Etiquetas
                    </Label>
                    <div className="flex flex-wrap gap-2 mt-2 max-h-[100px] overflow-y-auto p-2 border border-dashed">
                      {allTags.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          aria-pressed={editTagIds.includes(tag.id)}
                          onClick={() => {
                            setEditTagIds((prev) =>
                              prev.includes(tag.id)
                                ? prev.filter((id) => id !== tag.id)
                                : [...prev, tag.id],
                            );
                          }}
                          className={cn(
                            'min-h-8 font-body text-[10px] uppercase tracking-wider px-2 py-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                            editTagIds.includes(tag.id)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80',
                          )}
                        >
                          {tag.name}
                        </button>
                      ))}
                    </div>
                    <PageControls
                      page={tagPage}
                      total={tagTotal}
                      limit={20}
                      onChange={setTagPage}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={cancelEdits}
                    className="font-body text-xs uppercase tracking-wider"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleSaveEdits()}
                    disabled={
                      busy ||
                      !editAuthor.trim() ||
                      Array.from(editContent.trim()).length < 10
                    }
                    className="bg-primary text-primary-foreground font-body text-xs uppercase tracking-wider rounded-none"
                  >
                    {pending === 'edit' ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-8 animate-fade-in-up">
                <blockquote className="font-caption text-3xl md:text-4xl italic leading-tight text-foreground">
                  &ldquo;{testimonial.content}&rdquo;
                </blockquote>

                <div className="flex items-center gap-4">
                  <RatingDisplay rating={testimonial.rating} />
                  <div className="h-px flex-1 bg-border" />
                  <p className="font-body text-sm font-bold uppercase tracking-wider text-foreground">
                    — {testimonial.authorName}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Moderation & Media */}
          <div className="flex w-full shrink-0 flex-col gap-8 bg-background p-6 md:w-[320px] md:overflow-y-auto md:pt-16">
            {/* Status & Moderation */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Estado Actual
                </Label>
                <span
                  className={cn(
                    'px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider',
                    testimonial.status === 'published' &&
                      'bg-primary/10 text-primary',
                    testimonial.status === 'pending' &&
                      'bg-warning/10 text-warning',
                    testimonial.status === 'draft' &&
                      'bg-muted text-muted-foreground',
                    testimonial.status === 'approved' &&
                      'bg-success/10 text-success',
                    testimonial.status === 'rejected' &&
                      'bg-destructive/10 text-destructive',
                  )}
                >
                  {testimonialStatusLabels[testimonial.status] ??
                    testimonial.status}
                </span>
              </div>

              {canModerate ? (
                <div className="p-4 border bg-card">
                  <h3 className="font-body text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-3 h-3 text-primary" /> Moderación
                    Activa
                  </h3>
                  <p className="mb-3 font-body text-sm text-muted-foreground">
                    {testimonialStatusHelp[testimonial.status]}
                  </p>
                  {isEditing && (
                    <p className="mb-3 font-body text-sm">
                      Guardá o cancelá la edición antes de moderar.
                    </p>
                  )}
                  {videoUrl && (
                    <p className="mb-3 font-body text-sm">
                      Vinculá o borrá el enlace del video antes de moderar.
                    </p>
                  )}
                  <div className="flex flex-col gap-2">
                    {testimonial.status === 'draft' && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleStatusChange('submit')}
                        disabled={
                          busy || isEditing || rejectMode || Boolean(videoUrl)
                        }
                        className="w-full rounded-none font-body text-xs uppercase tracking-wider"
                      >
                        Enviar a revisión
                      </Button>
                    )}
                    {testimonial.status === 'pending' && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void handleStatusChange('approve')}
                          disabled={
                            busy || isEditing || rejectMode || Boolean(videoUrl)
                          }
                          className="w-full rounded-none font-body text-xs uppercase tracking-wider bg-foreground text-background hover:bg-foreground/90"
                        >
                          Aprobar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (rejectMode && rejectReason)
                              setDiscardTarget('reject');
                            else setRejectMode(!rejectMode);
                          }}
                          disabled={busy || isEditing || Boolean(videoUrl)}
                          className="w-full rounded-none font-body text-xs uppercase tracking-wider text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          Rechazar
                        </Button>
                      </>
                    )}
                    {testimonial.status === 'approved' && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleStatusChange('publish')}
                        disabled={
                          busy || isEditing || rejectMode || Boolean(videoUrl)
                        }
                        className="w-full rounded-none font-body text-xs uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        Publicar Ahora
                      </Button>
                    )}
                    {(testimonial.status === 'approved' ||
                      testimonial.status === 'published') && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (rejectMode && rejectReason)
                            setDiscardTarget('reject');
                          else setRejectMode(!rejectMode);
                        }}
                        disabled={busy || isEditing || Boolean(videoUrl)}
                        className="w-full rounded-none font-body text-xs uppercase tracking-wider text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        {isPublished ? 'Ocultar' : 'Rechazar'}
                      </Button>
                    )}

                    {rejectMode && (
                      <div className="mt-3 pt-3 border-t animate-fade-in-up">
                        <textarea
                          aria-label="Motivo del rechazo"
                          maxLength={500}
                          className="w-full border-b p-2 bg-transparent font-body text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus:border-destructive resize-y"
                          placeholder="Motivo del rechazo (opcional)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            void handleStatusChange('reject', {
                              reason: rejectReason,
                            })
                          }
                          disabled={busy || isEditing || Boolean(videoUrl)}
                          className="w-full rounded-none mt-2 font-body text-xs uppercase tracking-wider"
                        >
                          {isPublished
                            ? 'Confirmar ocultamiento'
                            : 'Confirmar rechazo'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            if (rejectReason) setDiscardTarget('reject');
                            else setRejectMode(false);
                          }}
                        >
                          Cancelar rechazo
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-dashed text-center">
                  <p className="font-body text-xs text-muted-foreground uppercase tracking-widest">
                    Modo Lectura
                  </p>
                </div>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* Media Section */}
            <div className="space-y-6">
              <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">
                Multimedia Adjunta
              </Label>

              {/* Image */}
              <div>
                <h4 className="font-body text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 mb-2 text-foreground">
                  <ImageIcon className="w-3 h-3 text-primary" /> Imagen
                </h4>
                {testimonial.imageUrl ? (
                  <div className="relative aspect-video bg-muted border overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={testimonial.imageUrl}
                      alt="Testimonial media"
                      className="object-cover w-full h-full opacity-80 mix-blend-multiply"
                    />
                  </div>
                ) : (
                  canAttach && (
                    <div className="relative">
                      <Input
                        aria-label="Imagen del testimonio"
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={(e) => void handleImageUpload(e)}
                        disabled={
                          busy || isEditing || rejectMode || Boolean(videoUrl)
                        }
                        className="font-body text-base md:text-sm rounded-none border-dashed bg-transparent file:bg-primary file:text-primary-foreground file:border-0 file:mr-4 file:px-2 file:py-1 cursor-pointer"
                      />
                      {loadingImage && (
                        <Loader2 className="absolute right-2 top-2 w-4 h-4 animate-spin text-primary" />
                      )}
                    </div>
                  )
                )}
              </div>

              {/* Video */}
              <div>
                <h4 className="font-body text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 mb-2 text-foreground">
                  <Youtube className="w-3 h-3 text-primary" /> Video (YouTube)
                </h4>
                {testimonial.videoUrl ? (
                  <div className="relative aspect-video bg-muted border overflow-hidden">
                    {testimonial.videoThumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={testimonial.videoThumbnailUrl}
                        alt="Video thumbnail"
                        className="object-cover w-full h-full opacity-80 mix-blend-multiply"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        Video Enlazado
                      </div>
                    )}
                  </div>
                ) : (
                  canAttach && (
                    <div className="flex flex-col gap-2">
                      <Input
                        aria-label="URL del video de YouTube"
                        placeholder="https://youtu.be/..."
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        disabled={busy || isEditing || rejectMode}
                        className="font-body text-base md:text-sm rounded-none bg-transparent"
                      />
                      <Button
                        type="button"
                        onClick={() => void handleVideoSubmit()}
                        disabled={
                          !videoUrl.trim() || busy || isEditing || rejectMode
                        }
                        variant="outline"
                        size="sm"
                        className="w-full font-body text-[10px] uppercase tracking-wider rounded-none"
                      >
                        {loadingVideo ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                          'Vincular'
                        )}
                      </Button>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </fieldset>
        {onDeleted &&
          (roles.includes('admin') ||
            (roles.includes('editor') &&
              testimonial.createdById === session?.user.id)) && (
            <div className="shrink-0 border-t bg-background px-6 py-4">
              <Button
                type="button"
                variant="destructive"
                disabled={busy || dirty || navigation?.busy}
                onClick={() =>
                  confirmation.confirm({
                    title: `Eliminar el testimonio de ${testimonial.authorName}`,
                    description: `Se borrarán definitivamente el testimonio y sus asociaciones. ${isPublished ? 'Dejará de estar disponible públicamente. ' : ''}Esta acción no se puede deshacer.`,
                    confirmLabel: 'Eliminar definitivamente',
                    task: 'la eliminación del testimonio',
                    action: async () => {
                      if (mutationLock.current) return;
                      mutationLock.current = true;
                      setPending('delete');
                      try {
                        await deleteTestimonial(fetchApi, testimonial.id);
                        onDeleted();
                      } finally {
                        mutationLock.current = false;
                        setPending(null);
                      }
                    },
                  })
                }
              >
                Eliminar testimonio
              </Button>
              {dirty && (
                <p className="mt-2 font-body text-sm text-muted-foreground">
                  Guardá o descartá tus cambios antes de eliminar.
                </p>
              )}
            </div>
          )}
        {confirmation.dialog}
        {busy && (
          <p role="status" className="px-6 pb-4 font-body text-sm">
            Guardando el testimonio. Esperá el resultado antes de cerrar.
          </p>
        )}
        <DiscardChangesDialog
          open={discardTarget !== null}
          onOpenChange={(value) => {
            if (!value) setDiscardTarget(null);
          }}
          onDiscard={discardChanges}
        />
      </DialogContent>
    </Dialog>
  );
}
