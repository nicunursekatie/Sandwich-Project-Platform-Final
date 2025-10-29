import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { ExpensesList } from '@/components/expenses/ExpensesList';

export default function ExpensesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleExpenseCreated = () => {
    setIsDialogOpen(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Expenses & Receipts</h1>
          <p className="text-muted-foreground mt-1">
            Track expenses and upload receipts for reimbursement
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Expense</DialogTitle>
              <DialogDescription>
                Enter expense details and upload a receipt for reimbursement
              </DialogDescription>
            </DialogHeader>
            <ExpenseForm
              onSuccess={handleExpenseCreated}
              onCancel={() => setIsDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <ExpensesList showFilters={true} />
    </div>
  );
}
