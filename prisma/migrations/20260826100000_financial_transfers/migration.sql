alter type "FinancialMovementType" add value if not exists 'TRANSFER_OUT';
alter type "FinancialMovementType" add value if not exists 'TRANSFER_IN';
alter type "FinancialMovementType" add value if not exists 'REVERSAL';
