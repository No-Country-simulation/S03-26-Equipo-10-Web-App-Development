'use client';

import { useState, useEffect } from 'react';
import { TestimonialRecord } from '@/lib/api';
import { useSession } from '@/hooks/use-session';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Youtube, Image as ImageIcon, Loader2, Edit3, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestimonialModalProps {
  testimonial: TestimonialRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function TestimonialModal({
  testimonial,
  open,
  onOpenChange,
  onUpdated,
}: TestimonialModalProps) {
  const { fetchApi, isAdmin } = useSession();
  
  const [videoUrl, setVideoUrl] = useState('');
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Edit Mode States
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editAuthor, setEditAuthor] = useState('');

  useEffect(() => {
    if (open && testimonial) {
      setRejectMode(false);
      setRejectReason('');
      setIsEditing(false);
      setEditContent(testimonial.content);
      setEditAuthor(testimonial.authorName);
    }
  }, [open, testimonial]);

  if (!testimonial) return null;

  const isPublished = testimonial.status === 'published';
  const canEdit = isAdmin;

  async function handleStatusChange(action: string, body?: any) {
    if (!testimonial) return;
    setStatusLoading(true);
    try {
      await fetchApi(`/testimonials/${testimonial.id}/${action}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      onUpdated();
      setRejectMode(false);
    } catch (err: any) {
      alert(`Error con la acción ${action}: ${err.message}`);
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleVideoSubmit() {
    if (!videoUrl.trim() || !testimonial) return;
    setLoadingVideo(true);
    try {
      await fetchApi(`/testimonials/${testimonial.id}/video`, {
        method: 'POST',
        body: JSON.stringify({ videoUrl }),
      });
      setVideoUrl('');
      onUpdated();
    } catch (e: any) {
      alert(e.message || 'Error adjuntando video');
    } finally {
      setLoadingVideo(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !testimonial) return;
    
    setLoadingImage(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          await fetchApi(`/testimonials/${testimonial.id}/image`, {
            method: 'POST',
            body: JSON.stringify({ imageBase64: base64 }),
          });
          onUpdated();
        } catch (err: any) {
          alert('Error subiendo imagen: ' + err.message);
        } finally {
          setLoadingImage(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (e) {
      setLoadingImage(false);
    }
  }

  async function handleSaveEdits() {
    if (!testimonial) return;
    setStatusLoading(true);
    try {
      await fetchApi(`/testimonials/${testimonial.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          authorName: editAuthor,
          content: editContent,
        }),
      });
      setIsEditing(false);
      onUpdated();
    } catch (err: any) {
      alert('Error guardando edición: ' + err.message);
    } finally {
      setStatusLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-0 bg-background rounded-none shadow-2xl">
        <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
          
          {/* Left Column: Visual & Content (Neo-Editorial) */}
          <div className="flex-1 bg-card p-8 md:p-12 border-b md:border-b-0 md:border-r relative overflow-y-auto">
            <div className="absolute top-0 left-0 w-full h-1 bg-primary/20" />
            
            <div className="flex items-center justify-between mb-8">
              <span className="font-body text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/20 px-2 py-1">
                {testimonial.id.split('-')[0]}
              </span>
              
              {canEdit && !isEditing && (
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="h-8 font-body text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
                  <Edit3 className="w-3 h-3 mr-2" /> Editar Texto
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-6 animate-fade-in-up">
                <div>
                  <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Autor</Label>
                  <Input 
                    value={editAuthor} 
                    onChange={e => setEditAuthor(e.target.value)} 
                    className="mt-2 font-caption text-xl bg-background rounded-none border-t-0 border-x-0 border-b-2 focus-visible:ring-0 focus-visible:border-primary px-0" 
                  />
                </div>
                <div>
                  <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contenido</Label>
                  <textarea 
                    value={editContent} 
                    onChange={e => setEditContent(e.target.value)} 
                    className="w-full mt-2 bg-background font-caption text-2xl italic leading-relaxed focus:outline-none focus:ring-0 resize-none min-h-[150px] border-b-2 border-border focus:border-primary"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="ghost" onClick={() => setIsEditing(false)} className="font-body text-xs uppercase tracking-wider">Cancelar</Button>
                  <Button onClick={() => void handleSaveEdits()} disabled={statusLoading} className="bg-primary text-primary-foreground font-body text-xs uppercase tracking-wider rounded-none">
                    {statusLoading ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-8 animate-fade-in-up">
                <blockquote className="font-caption text-3xl md:text-4xl italic leading-tight text-foreground">
                  &ldquo;{testimonial.content}&rdquo;
                </blockquote>
                
                <div className="flex items-center gap-4">
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} className={cn('h-5 w-5', i < testimonial.rating ? 'text-primary' : 'text-muted-foreground/20')} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <div className="h-px flex-1 bg-border" />
                  <p className="font-body text-sm font-bold uppercase tracking-wider text-foreground">
                    — {testimonial.authorName}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Moderation & Media */}
          <div className="w-full md:w-[320px] bg-background p-6 flex flex-col gap-8 overflow-y-auto">
            
            {/* Status & Moderation */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estado Actual</Label>
                <span className={cn(
                  'px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider',
                  testimonial.status === 'published' && 'bg-primary/20 text-primary',
                  testimonial.status === 'pending' && 'bg-accent/20 text-accent',
                  testimonial.status === 'draft' && 'bg-muted text-muted-foreground',
                  testimonial.status === 'approved' && 'bg-primary/10 text-primary',
                  testimonial.status === 'rejected' && 'bg-destructive/20 text-destructive',
                )}>
                  {testimonial.status}
                </span>
              </div>

              {canEdit ? (
                <div className="p-4 border bg-card">
                  <h3 className="font-body text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-3 h-3 text-primary" /> Moderación Activa
                  </h3>
                  <div className="flex flex-col gap-2">
                    {testimonial.status === 'draft' && (
                      <Button size="sm" onClick={() => void handleStatusChange('submit')} disabled={statusLoading} className="w-full rounded-none font-body text-xs uppercase tracking-wider">Enviar a revisión</Button>
                    )}
                    {testimonial.status === 'pending' && (
                      <>
                        <Button size="sm" onClick={() => void handleStatusChange('approve')} disabled={statusLoading} className="w-full rounded-none font-body text-xs uppercase tracking-wider bg-foreground text-background hover:bg-foreground/90">Aprobar</Button>
                        <Button size="sm" variant="outline" onClick={() => setRejectMode(!rejectMode)} disabled={statusLoading} className="w-full rounded-none font-body text-xs uppercase tracking-wider text-destructive border-destructive/30 hover:bg-destructive/10">Rechazar</Button>
                      </>
                    )}
                    {testimonial.status === 'approved' && (
                      <Button size="sm" onClick={() => void handleStatusChange('publish')} disabled={statusLoading} className="w-full rounded-none font-body text-xs uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90">Publicar Ahora</Button>
                    )}
                    {testimonial.status === 'published' && (
                      <Button size="sm" variant="outline" onClick={() => setRejectMode(!rejectMode)} disabled={statusLoading} className="w-full rounded-none font-body text-xs uppercase tracking-wider text-destructive border-destructive/30 hover:bg-destructive/10">Ocultar</Button>
                    )}

                    {rejectMode && (
                      <div className="mt-3 pt-3 border-t animate-fade-in-up">
                        <textarea 
                          className="w-full border-b p-2 bg-transparent font-body text-xs focus:outline-none focus:border-destructive resize-none"
                          placeholder="Motivo del rechazo (opcional)"
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                        />
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          onClick={() => void handleStatusChange('reject', { reason: rejectReason })}
                          disabled={statusLoading}
                          className="w-full rounded-none mt-2 font-body text-xs uppercase tracking-wider"
                        >Confirmar</Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-dashed text-center">
                   <p className="font-body text-xs text-muted-foreground uppercase tracking-widest">Modo Lectura</p>
                </div>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* Media Section */}
            <div className="space-y-6">
              <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Multimedia Adjunta</Label>
              
              {/* Image */}
              <div>
                <h4 className="font-body text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 mb-2 text-foreground">
                  <ImageIcon className="w-3 h-3 text-primary" /> Imagen
                </h4>
                {testimonial.imageUrl ? (
                  <div className="relative aspect-video bg-muted border overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={testimonial.imageUrl} alt="Testimonial media" className="object-cover w-full h-full opacity-80 mix-blend-multiply" />
                  </div>
                ) : (
                  canEdit && !isPublished && (
                    <div className="relative">
                      <Input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={(e) => void handleImageUpload(e)}
                        disabled={loadingImage}
                        className="font-body text-[10px] rounded-none border-dashed bg-transparent file:bg-primary file:text-primary-foreground file:border-0 file:mr-4 file:px-2 file:py-1 cursor-pointer"
                      />
                      {loadingImage && <Loader2 className="absolute right-2 top-2 w-4 h-4 animate-spin text-primary" />}
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
                     <img src={testimonial.videoThumbnailUrl} alt="Video thumbnail" className="object-cover w-full h-full opacity-80 mix-blend-multiply" />
                   ) : (
                     <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Video Enlazado</div>
                   )}
                 </div>
                ) : (
                  canEdit && !isPublished && (
                    <div className="flex flex-col gap-2">
                      <Input
                        placeholder="https://youtu.be/..."
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        disabled={loadingVideo}
                        className="font-body text-[10px] rounded-none bg-transparent"
                      />
                      <Button 
                        onClick={() => void handleVideoSubmit()}
                        disabled={!videoUrl || loadingVideo}
                        variant="outline"
                        size="sm"
                        className="w-full font-body text-[10px] uppercase tracking-wider rounded-none"
                      >
                        {loadingVideo ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : 'Vincular'}
                      </Button>
                    </div>
                  )
                )}
              </div>

            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
