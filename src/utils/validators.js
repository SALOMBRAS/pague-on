const { z } = require('zod');

const uuid = z.string().uuid();
const amount = z.coerce.number().positive();
const optionalAmount = z.coerce.number().positive().optional();
const isoDate = z.coerce.date();
const currencyCode = z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase());

const enums = {
  debtType: z.enum(['RECEIVABLE', 'PAYABLE']),
  paymentType: z.enum(['SINGLE', 'INSTALLMENT', 'RECURRING']),
  category: z.enum(['PRODUCT', 'SERVICE', 'LOAN', 'RENT', 'SUBSCRIPTION', 'TRANSPORT', 'UTILITIES', 'OTHER']),
  debtStatus: z.enum(['PENDING', 'PAID', 'OVERDUE', 'PARTIAL', 'CANCELLED']),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']),
  reminderType: z.enum(['PUSH', 'WHATSAPP', 'SMS']),
  assetType: z.enum(['CASH', 'INVESTMENT_STOCK', 'INVESTMENT_CRYPTO', 'INVESTMENT_FIXED', 'PROPERTY', 'VEHICLE', 'OTHER']),
};

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(6).max(128),
  phone: z.string().trim().max(30).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(32).max(512),
}).strict();

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  avatar: z.string().max(500).nullable().optional(),
  currency: z.string().trim().length(3).optional(),
  theme: z.string().trim().max(30).optional(),
  notificationEnabled: z.boolean().optional(),
  reminderDefaultTime: z.coerce.number().int().min(0).max(525600).nullable().optional(),
  dueReminderDays: z.coerce.number().int().min(0).max(30).optional(),
  budgetAlerts: z.boolean().optional(),
  stockAlerts: z.boolean().optional(),
  weeklyDigest: z.boolean().optional(),
  monthlyDigest: z.boolean().optional(),
  notificationSound: z.enum(['DEFAULT', 'SILENT']).optional(),
  defaultMessage: z.string().max(2000).nullable().optional(),
  duplicateSensitivity: z.coerce.number().int().min(50).max(100).optional(),
}).strict();

const passwordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6).max(128),
});

const debtFields = {
  type: enums.debtType,
  paymentType: enums.paymentType,
  description: z.string().trim().min(2).max(500),
  category: enums.category,
  counterparty: z.string().trim().min(2).max(200).optional(),
  counterpartyPhone: z.string().trim().max(30).nullable().optional(),
  customerId: uuid.nullable().optional(),
  totalAmount: amount,
  installmentAmount: optionalAmount.nullable(),
  totalInstallments: z.coerce.number().int().min(2).max(360).nullable().optional(),
  frequency: enums.frequency.nullable().optional(),
  startDate: isoDate,
  endDate: isoDate.nullable().optional(),
  repeatCount: z.coerce.number().int().min(1).max(10000).nullable().optional(),
  productId: uuid.nullable().optional(),
  quantity: z.coerce.number().int().positive().nullable().optional(),
  allowDuplicate: z.boolean().optional(),
  currency: currencyCode.default('BRL'),
};

const debtCreateSchema = z.object(debtFields).strict().superRefine((value, context) => {
  if (value.paymentType === 'INSTALLMENT' && !value.totalInstallments) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['totalInstallments'], message: 'Informe o total de parcelas.' });
  }
  if (value.paymentType === 'RECURRING' && !value.frequency) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['frequency'], message: 'Informe a frequência da recorrência.' });
  }
  if (!value.counterparty && !value.customerId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['counterparty'], message: 'Informe a contraparte ou um cliente.' });
  }
  if (value.endDate && value.endDate < value.startDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'A data final deve ser posterior ao início.' });
  }
});

const debtUpdateSchema = z.object({
  description: debtFields.description.optional(),
  category: debtFields.category.optional(),
  counterparty: debtFields.counterparty,
  counterpartyPhone: debtFields.counterpartyPhone,
  customerId: debtFields.customerId,
  totalAmount: debtFields.totalAmount.optional(),
  installmentAmount: debtFields.installmentAmount,
  totalInstallments: debtFields.totalInstallments,
  frequency: debtFields.frequency,
  startDate: isoDate.optional(),
  endDate: debtFields.endDate,
  repeatCount: debtFields.repeatCount,
  productId: debtFields.productId,
  quantity: debtFields.quantity,
}).strict();

const paySchema = z.object({ paidAmount: optionalAmount.optional() }).strict();

const productCreateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  category: z.string().trim().max(100).nullable().optional(),
  costPrice: amount,
  sellingPrice: amount,
  stockQuantity: z.coerce.number().int().min(0).max(1000000).default(0),
  minStockAlert: z.coerce.number().int().min(0).max(1000000).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
}).strict();

const productUpdateSchema = productCreateSchema.partial().extend({ isActive: z.boolean().optional() }).strict();

const purchaseCreateSchema = z.object({
  productId: uuid,
  quantity: z.coerce.number().int().positive().max(1000000),
  unitCost: amount,
  supplier: z.string().trim().max(200).nullable().optional(),
  date: isoDate,
  notes: z.string().trim().max(2000).nullable().optional(),
}).strict();

const reminderCreateSchema = z.object({
  debtId: uuid.nullable().optional(),
  type: enums.reminderType.default('PUSH'),
  scheduledAt: isoDate,
  message: z.string().trim().max(2000).nullable().optional(),
}).strict();

const customerCreateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  nickname: z.string().trim().max(100).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().max(255).nullable().optional(),
  cpfCnpj: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  avatar: z.string().url().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
}).strict();

const customerUpdateSchema = customerCreateSchema.partial().extend({ isActive: z.boolean().optional() }).strict();

const saleItemSchema = z.object({
  productId: uuid,
  quantity: z.coerce.number().int().positive().max(1000000),
  unitPrice: optionalAmount.optional(),
}).strict();

const saleCreateSchema = z.object({
  customerId: uuid.nullable().optional(),
  personId: uuid.nullable().optional(),
  items: z.array(saleItemSchema).min(1).max(100).optional(),
  productId: uuid.nullable().optional(),
  productName: z.string().trim().min(2).max(200).optional(),
  quantity: z.coerce.number().int().positive().max(1000000).default(1),
  unitPrice: optionalAmount.optional(),
  discount: z.coerce.number().min(0).max(100000000).default(0),
  paymentType: z.enum(['SINGLE', 'INSTALLMENT']).default('SINGLE'),
  totalInstallments: z.coerce.number().int().min(2).max(360).nullable().optional(),
  installmentAmount: optionalAmount.nullable().optional(),
  frequency: enums.frequency.default('MONTHLY'),
  firstDueDate: isoDate.optional(),
  interestType: z.enum(['NONE', 'SIMPLE', 'COMPOUND', 'DAILY', 'FIXED_FEE']).default('NONE'),
  interestRate: z.coerce.number().min(0).max(1000000).default(0),
  startDate: isoDate.optional(),
  description: z.string().trim().min(2).max(500).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.paymentType === 'INSTALLMENT' && !value.totalInstallments) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['totalInstallments'], message: 'Informe o total de parcelas.' });
  }
  if (!value.items?.length && (!value.productId || !value.productName || !value.unitPrice)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Informe os itens da venda ou produto, nome e preço.' });
  }
  if (value.customerId && value.personId && value.customerId !== value.personId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['personId'], message: 'Informe apenas uma pessoa para a venda.' });
});

const paymentCreateSchema = z.object({
  debtId: uuid,
  installmentId: uuid.optional(),
  paidAmount: optionalAmount.optional(),
}).strict();

const saleUpdateSchema = z.object({
  customerId: uuid.nullable().optional(),
  personId: uuid.nullable().optional(),
  description: z.string().trim().min(2).max(500).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  paymentType: z.enum(['SINGLE', 'INSTALLMENT']).optional(),
  totalInstallments: z.coerce.number().int().min(2).max(360).nullable().optional(),
  installmentAmount: optionalAmount.nullable().optional(),
  frequency: enums.frequency.nullable().optional(),
  firstDueDate: isoDate.optional(),
  interestType: z.enum(['NONE', 'SIMPLE', 'COMPOUND', 'DAILY', 'FIXED_FEE']).optional(),
  interestRate: z.coerce.number().min(0).max(1000000).optional(),
  totalAmount: optionalAmount.optional(),
  discount: z.coerce.number().min(0).max(100000000).optional(),
}).strict();

const addExtraSchema = z.object({
  amount: amount,
  dueDate: isoDate.optional(),
}).strict();
const installmentPaySchema = z.object({ paidAmount: z.coerce.number().positive().max(9999999999).optional(), paymentDate: isoDate.optional(), paymentMethod: z.enum(['CASH', 'PIX', 'CARD', 'TRANSFER', 'OTHER']).optional(), note: z.string().trim().max(1000).nullable().optional() }).strict();

const idSchema = z.object({ id: uuid });

const ruleTriggerSchema = z.object({
  type: z.enum(['DESCRIPTION_CONTAINS', 'DESCRIPTION_STARTS_WITH', 'DESCRIPTION_IS', 'AMOUNT_EXACTLY', 'AMOUNT_GREATER_THAN', 'AMOUNT_LESS_THAN', 'COUNTERPARTY_IS', 'COUNTERPARTY_CONTAINS', 'CATEGORY_IS', 'TYPE_IS']),
  value: z.string().trim().min(1).max(500),
  operator: z.enum(['EQUALS', 'CONTAINS', 'STARTS_WITH', 'GREATER_THAN', 'LESS_THAN']).default('EQUALS'),
}).strict();

const ruleActionSchema = z.object({
  type: z.enum(['SET_CATEGORY', 'SET_TYPE', 'SET_PAYMENT_TYPE', 'ADD_TAG', 'SET_REMINDER', 'SEND_NOTIFICATION', 'SET_COUNTERPARTY']),
  value: z.string().trim().min(1).max(1000),
}).strict().superRefine((action, context) => {
  const valid = {
    SET_CATEGORY: ['PRODUCT', 'SERVICE', 'LOAN', 'RENT', 'SUBSCRIPTION', 'TRANSPORT', 'UTILITIES', 'OTHER'],
    SET_TYPE: ['RECEIVABLE', 'PAYABLE'],
    SET_PAYMENT_TYPE: ['SINGLE', 'RECURRING'],
  };
  if (valid[action.type] && !valid[action.type].includes(action.value)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Valor incompatível com esta ação.' });
  if (action.type === 'SET_REMINDER' && (!Number.isInteger(Number(action.value)) || Number(action.value) < 0 || Number(action.value) > 365)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Informe entre 0 e 365 dias.' });
});

const ruleCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  order: z.coerce.number().int().min(0).max(100000).default(0),
  isActive: z.boolean().default(true),
  triggerLogic: z.enum(['ALL', 'ANY']).default('ALL'),
  triggers: z.array(ruleTriggerSchema).min(1).max(10),
  actions: z.array(ruleActionSchema).min(1).max(10),
}).strict();

const ruleUpdateSchema = ruleCreateSchema.partial().extend({
  triggers: z.array(ruleTriggerSchema).min(1).max(10).optional(),
  actions: z.array(ruleActionSchema).min(1).max(10).optional(),
}).strict();

const ruleTestSchema = z.object({ debtId: uuid }).strict();

const pinSchema = z.object({ pin: z.string().regex(/^\d{4,6}$/, 'O PIN deve ter de 4 a 6 dígitos.') }).strict();
const securitySettingsSchema = z.object({
  lockTimeout: z.coerce.number().int().min(1).max(60).optional(),
  hideValues: z.boolean().optional(),
}).strict();
const webauthnCredentialSchema = z.object({ id: z.string().min(1).max(2048), rawId: z.string().min(1).max(2048).optional(), type: z.literal('public-key'), response: z.object({}).passthrough(), clientExtensionResults: z.object({}).passthrough().optional() }).passthrough();
const assetCreateSchema = z.object({ name: z.string().trim().min(2).max(160), type: enums.assetType, value: z.coerce.number().nonnegative().max(9999999999), currency: z.string().trim().length(3).default('BRL'), isLiquid: z.boolean().default(true), description: z.string().trim().max(1000).nullable().optional() }).strict();
const assetUpdateSchema = assetCreateSchema.partial().strict();
const budgetCreateSchema = z.object({ category: enums.category, month: z.coerce.number().int().min(1).max(12), year: z.coerce.number().int().min(2020).max(2200), limitAmount: z.coerce.number().positive().max(9999999999), rollover: z.boolean().default(false), alertAt: z.coerce.number().int().min(1).max(100).default(80) }).strict();
const budgetUpdateSchema = z.object({ limitAmount: z.coerce.number().positive().max(9999999999).optional(), rollover: z.boolean().optional(), alertAt: z.coerce.number().int().min(1).max(100).optional() }).strict();
const budgetQuerySchema = z.object({ month: z.coerce.number().int().min(1).max(12).default(new Date().getUTCMonth() + 1), year: z.coerce.number().int().min(2020).max(2200).default(new Date().getUTCFullYear()) }).strict();
const reconciliationUploadSchema = z.object({ fileName: z.string().trim().min(1).max(255), content: z.string().min(1).max(1024 * 1024), accountName: z.string().trim().max(160).nullable().optional() }).strict();
const reconciliationMatchSchema = z.object({ statementId: uuid }).strict();
const reconciliationConfirmSchema = z.object({ statementId: uuid, decisions: z.array(z.object({ transactionId: uuid, action: z.enum(['CONFIRM', 'IGNORE', 'CREATE']), debtId: uuid.nullable().optional() }).strict()).min(1).max(500) }).strict();
const currencyConvertSchema = z.object({ amount: z.coerce.number().nonnegative().max(9999999999), from: currencyCode, to: currencyCode.default('BRL') }).strict();
const statementImportSchema = z.object({ fileName: z.string().trim().min(1).max(255), accountName: z.string().trim().max(160).nullable().optional(), transactions: z.array(z.object({ date: isoDate, description: z.string().trim().min(1).max(500), amount: z.coerce.number().refine((value) => Number.isFinite(value) && value !== 0), externalId: z.string().trim().max(200).nullable().optional() }).strict()).min(1).max(5000) }).strict();
const pushSubscriptionSchema = z.object({ endpoint: z.string().url().max(2048), expirationTime: z.coerce.date().nullable().optional(), keys: z.object({ p256dh: z.string().min(16).max(1024), auth: z.string().min(8).max(1024) }).strict() }).strict();
const pushUnsubscribeSchema = z.object({ endpoint: z.string().url().max(2048) }).strict();

module.exports = {
  enums,
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  profileSchema,
  passwordSchema,
  debtCreateSchema,
  debtUpdateSchema,
  paySchema,
  productCreateSchema,
  productUpdateSchema,
  purchaseCreateSchema,
  reminderCreateSchema,
  customerCreateSchema,
  customerUpdateSchema,
  saleCreateSchema,
  saleUpdateSchema,
  addExtraSchema,
  paymentCreateSchema,
  installmentPaySchema,
  ruleCreateSchema,
  ruleUpdateSchema,
  ruleTestSchema,
  pinSchema,
  securitySettingsSchema,
  webauthnCredentialSchema,
  assetCreateSchema,
  assetUpdateSchema,
  budgetCreateSchema,
  budgetUpdateSchema,
  budgetQuerySchema,
  reconciliationUploadSchema,
  reconciliationMatchSchema,
  reconciliationConfirmSchema,
  currencyConvertSchema,
  statementImportSchema,
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
  idSchema,
};
