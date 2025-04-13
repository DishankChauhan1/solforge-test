export const formatCurrency = (amount: number, currency: string = 'SOL'): string => {
  return `${amount.toLocaleString()} ${currency}`;
};

export const formatUSD = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}; 