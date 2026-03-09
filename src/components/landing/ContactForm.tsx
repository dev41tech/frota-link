import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Rocket } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatWhatsAppMessage } from "@/lib/whatsappFormatter";

const contactSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(100, "Nome muito longo"),
  email: z.string().email("E-mail inválido").max(255, "E-mail muito longo"),
  phone: z.string().min(10, "Telefone inválido").max(20, "Telefone inválido"),
  company: z.string().min(2, "Nome da empresa muito curto").max(100, "Nome muito longo"),
  fleetSize: z.string().min(1, "Selecione o tamanho da frota"),
  message: z.string().max(1000, "Mensagem muito longa").optional()
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactFormProps {
  variant?: "primary" | "secondary";
}

export default function ContactForm({ variant = "primary" }: ContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema)
  });

  const fleetSize = watch("fleetSize");

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    
    try {
      const whatsappUrl = formatWhatsAppMessage({
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        fleetSize: data.fleetSize,
        message: data.message || ""
      });

      window.open(whatsappUrl, '_blank');
      
      toast({
        title: "✅ Solicitação enviada!",
        description: "Você será redirecionado para o WhatsApp. Nossa equipe responderá em até 2 horas úteis.",
        duration: 5000,
      });
    } catch (error) {
      toast({
        title: "Erro ao enviar",
        description: "Por favor, tente novamente ou entre em contato diretamente pelo WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${variant === "primary" ? "bg-card shadow-elevated" : "bg-muted/50"} rounded-2xl p-8 border`}>
      <div className="text-center mb-6">
        <h3 className="text-2xl md:text-3xl font-bold mb-3">
          Agende Sua Consultoria Gratuita
        </h3>
        <p className="text-muted-foreground mb-4">
          Sem compromisso. Descubra como reduzir custos e aumentar eficiência.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <span>Sem compromisso</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <span>Resposta em até 2h</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <span>100% LGPD</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Nome Completo *</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="João Silva"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="company">Empresa *</Label>
            <Input
              id="company"
              {...register("company")}
              placeholder="Transportes ABC"
              className={errors.company ? "border-destructive" : ""}
            />
            {errors.company && (
              <p className="text-xs text-destructive mt-1">{errors.company.message}</p>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">E-mail Corporativo *</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              placeholder="joao@empresa.com.br"
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="phone">Telefone (WhatsApp) *</Label>
            <Input
              id="phone"
              type="tel"
              {...register("phone")}
              placeholder="(41) 98863-3361"
              className={errors.phone ? "border-destructive" : ""}
            />
            {errors.phone && (
              <p className="text-xs text-destructive mt-1">{errors.phone.message}</p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="fleetSize">Tamanho da Frota *</Label>
          <Select onValueChange={(value) => setValue("fleetSize", value)} value={fleetSize}>
            <SelectTrigger className={errors.fleetSize ? "border-destructive" : ""}>
              <SelectValue placeholder="Selecione o tamanho da sua frota" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1-5">1-5 veículos</SelectItem>
              <SelectItem value="6-15">6-15 veículos</SelectItem>
              <SelectItem value="16-30">16-30 veículos</SelectItem>
              <SelectItem value="31-50">31-50 veículos</SelectItem>
              <SelectItem value="50+">Mais de 50 veículos</SelectItem>
            </SelectContent>
          </Select>
          {errors.fleetSize && (
            <p className="text-xs text-destructive mt-1">{errors.fleetSize.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="message">Principal Desafio (Opcional)</Label>
          <Textarea
            id="message"
            {...register("message")}
            placeholder="Conte-nos qual o maior desafio na gestão da sua frota..."
            rows={4}
            className={errors.message ? "border-destructive" : ""}
          />
          {errors.message && (
            <p className="text-xs text-destructive mt-1">{errors.message.message}</p>
          )}
        </div>

        <Button 
          type="submit" 
          className="w-full py-6 text-lg shadow-lg hover:shadow-xl transition-all"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            "Enviando..."
          ) : (
            <>
              <Rocket className="mr-2 h-5 w-5" />
              Quero Agendar Minha Reunião
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Ao enviar, você concorda com nossa{" "}
          <a href="#" className="text-primary hover:underline">Política de Privacidade</a> e 
          os <a href="#" className="text-primary hover:underline">Termos de Uso</a>.
        </p>
      </form>
    </div>
  );
}
