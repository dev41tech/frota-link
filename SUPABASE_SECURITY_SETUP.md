# 🔒 Guia de Configuração de Segurança do Supabase

## ✅ Cron Job Configurado
O cron job para notificações de contas a pagar foi configurado com sucesso e executará automaticamente todos os dias às 8h da manhã.

Você pode verificar os cron jobs ativos executando esta query no SQL Editor:
```sql
SELECT * FROM public.get_cron_jobs();
```

---

## ⚠️ AÇÃO NECESSÁRIA: Proteção de Senhas

O Supabase Linter detectou que a **Proteção de Senhas Vazadas** está desabilitada. Você precisa configurar manualmente no Dashboard do Supabase.

### Passo a Passo:

1. **Acesse o Dashboard do Supabase:**
   - URL: https://supabase.com/dashboard/project/hxfhubhijampubrsqfhg/auth/providers

2. **Configure Proteções de Senha:**
   - No menu lateral, vá em: **Authentication** > **Providers**
   - Role até a seção **"Auth Providers"**
   - Clique em **"Email"** para expandir as configurações

3. **Habilite as seguintes proteções:**

   ✅ **Leaked Password Protection** (CRÍTICO)
   - Marque a opção "Enable Leaked Password Protection"
   - Isso impede que usuários usem senhas comprometidas em vazamentos de dados

   ✅ **Minimum Password Length**
   - Defina: **8 caracteres** (mínimo recomendado)

   ✅ **Password Strength Requirements**
   - Marque: "Require lowercase letters (a-z)"
   - Marque: "Require uppercase letters (A-Z)"
   - Marque: "Require numbers (0-9)"
   - Marque: "Require special characters (!@#$%^&*)"

4. **Configure Rate Limiting (Anti-Força Bruta):**
   - Vá em: **Authentication** > **Rate Limits**
   - Defina: **5 tentativas por hora**
   - Isso protege contra ataques de força bruta

5. **Salve as configurações**
   - Clique em **"Save"** no final da página

---

## 📋 Checklist de Segurança

Após configurar, verifique se tudo está correto:

- [ ] Leaked Password Protection habilitado
- [ ] Senha mínima de 8 caracteres configurada
- [ ] Requisitos de complexidade de senha ativos (maiúscula, minúscula, número, especial)
- [ ] Rate Limiting configurado (5 tentativas/hora)
- [ ] Cron job de notificações ativo (execute `SELECT * FROM public.get_cron_jobs();`)

---

## 🔗 Links Úteis

- **Dashboard de Autenticação**: https://supabase.com/dashboard/project/hxfhubhijampubrsqfhg/auth/providers
- **Rate Limits**: https://supabase.com/dashboard/project/hxfhubhijampubrsqfhg/auth/rate-limits
- **Documentação Oficial**: https://supabase.com/docs/guides/auth/password-security

---

## ⏭️ Próximos Passos

Depois de configurar a segurança:
1. ✅ Sistema de Pagamentos (Mercado Pago/Stripe) - **PRIORIDADE #1**
2. ✅ Implementar Reset de Senha Self-Service
3. ✅ Implementar Auditoria de Acessos

---

**IMPORTANTE:** Não prossiga com a venda do sistema antes de:
- ✅ Configurar as proteções de senha acima
- ✅ Implementar o sistema de pagamentos
- ✅ Testar o cron job de notificações
