import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, FileText, Folder, User } from 'lucide-react';
import type { MeetingNote } from '@shared/schema';

interface NotesHistoryTabProps {
  selectedMeeting: any;
}

export function NotesHistoryTab({ selectedMeeting }: NotesHistoryTabProps) {
  // Fetch all meeting notes
  const { data: notes = [], isLoading } = useQuery<MeetingNote[]>({
    queryKey: ['/api/meeting-notes'],
  });

  // Sort notes by created date (newest first)
  const sortedNotes = [...notes].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Group notes by project
  const notesByProject = sortedNotes.reduce((acc, note) => {
    const projectId = note.projectId;
    if (!acc[projectId]) {
      acc[projectId] = [];
    }
    acc[projectId].push(note);
    return acc;
  }, {} as Record<number, MeetingNote[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading notes history...</div>
      </div>
    );
  }

  if (sortedNotes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No notes yet</p>
            <p className="text-sm mt-2">Meeting notes will appear here once created</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          Notes History
        </h2>
        <Badge variant="outline" className="text-gray-600">
          {sortedNotes.length} {sortedNotes.length === 1 ? 'note' : 'notes'}
        </Badge>
      </div>

      <div className="space-y-4">
        {sortedNotes.map((note) => (
          <Card key={note.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-teal-600" />
                  <span className="text-sm font-medium text-gray-900">
                    Project #{note.projectId}
                  </span>
                  {note.meetingId && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-sm text-gray-600">
                        Meeting #{note.meetingId}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={note.status === 'active' ? 'default' : 'outline'}
                    className={
                      note.status === 'active' 
                        ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                        : 'bg-gray-100 text-gray-600'
                    }
                  >
                    {note.status}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {note.type}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="prose prose-sm max-w-none">
                <div className="text-gray-700 whitespace-pre-wrap">
                  {typeof note.content === 'string' 
                    ? note.content 
                    : JSON.stringify(note.content, null, 2)}
                </div>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  {note.createdByName && (
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>{note.createdByName}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {new Date(note.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
