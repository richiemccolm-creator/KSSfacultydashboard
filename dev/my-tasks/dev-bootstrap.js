/**
 * Development preview — localStorage only, no auth required.
 */
(function() {
  var STORAGE_KEY = 'my-tasks-dev-v1';
  var DATA_TYPE = 'teacherTasksV1';

  window.__authReady = true;
  window.__authGuardIsAdmin = false;

  window.DataService = {
    get: function(dataType) {
      if (dataType !== DATA_TYPE) return Promise.resolve(null);
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        return Promise.resolve(raw ? JSON.parse(raw) : null);
      } catch (e) {
        return Promise.resolve(null);
      }
    },
    set: function(dataType, data) {
      if (dataType !== DATA_TYPE) return Promise.resolve();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {}
      return Promise.resolve();
    }
  };

  function isoOffset(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  window.MyTasksDev = {
    resetSampleData: function() {
      var sample = {
        buckets: [
          { id: 'b-week', title: 'This week', sort: 0 },
          { id: 'b-plan', title: 'Planning', sort: 1 }
        ],
        tasks: [
          {
            id: 't-s3',
            bucketId: 'b-week',
            title: 'Complete S3 reports',
            status: 'in_progress',
            category: 'Assessment',
            description: 'Finish comment banks and grades for all S3 classes before Friday.',
            notes: '',
            dueDate: isoOffset(0),
            priority: 'high',
            completed: false,
            checklist: [
              { id: 'c1', text: 'Drama classes', done: true },
              { id: 'c2', text: 'Art classes', done: true },
              { id: 'c3', text: 'Photography', done: false }
            ],
            attachments: [{ id: 'a1', type: 'link', label: 'Report template', url: 'https://example.com/reports', addedAt: new Date().toISOString() }],
            comments: [],
            sort: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 't-n5',
            bucketId: 'b-plan',
            title: 'Moderate N5 folios',
            status: 'todo',
            category: 'Assessment',
            description: 'Cross-mark folios with colleague before submission deadline.',
            notes: 'Book room 12 for Tuesday.',
            dueDate: isoOffset(2),
            priority: 'high',
            completed: false,
            checklist: [],
            attachments: [],
            comments: [],
            sort: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 't-meet',
            bucketId: 'b-plan',
            title: 'Prepare departmental meeting',
            status: 'waiting',
            category: 'Meetings',
            description: 'Waiting on HT approval for agenda item on tracking policy.',
            notes: '',
            dueDate: isoOffset(4),
            priority: 'normal',
            completed: false,
            checklist: [
              { id: 'c4', text: 'Draft agenda', done: true },
              { id: 'c5', text: 'Circulate papers', done: false }
            ],
            attachments: [],
            comments: [],
            sort: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 't-overdue',
            bucketId: 'b-week',
            title: 'Submit trip risk assessment',
            status: 'todo',
            category: 'Admin',
            description: 'Theatre visit risk assessment for parental consent.',
            notes: '',
            dueDate: isoOffset(-3),
            priority: 'high',
            completed: false,
            checklist: [],
            attachments: [],
            comments: [],
            sort: 2,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 't-done',
            bucketId: 'b-week',
            title: 'Order darkroom chemicals',
            status: 'completed',
            category: 'Admin',
            description: '',
            notes: 'PO ref 4421',
            dueDate: isoOffset(-1),
            priority: 'low',
            completed: true,
            checklist: [],
            attachments: [],
            comments: [],
            sort: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      };
      return DataService.set(DATA_TYPE, sample).then(function() {
        if (window.TeacherTasksService && typeof TeacherTasksService.load === 'function') {
          return TeacherTasksService.load();
        }
      });
    },

    clearData: function() {
      localStorage.removeItem(STORAGE_KEY);
      return Promise.resolve();
    }
  };

  DataService.get(DATA_TYPE).then(function(raw) {
    if (!raw || !raw.tasks || !raw.tasks.length) {
      return window.MyTasksDev.resetSampleData();
    }
  });

  try {
    var existingRaw = localStorage.getItem(STORAGE_KEY);
    var existing = existingRaw ? JSON.parse(existingRaw) : null;
    if (!existing || !existing.tasks || !existing.tasks.length) {
      var d = new Date();
      function isoOffset(days) {
        var x = new Date(d);
        x.setDate(x.getDate() + days);
        return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        buckets: [{ id: 'b-week', title: 'This week', sort: 0 }, { id: 'b-plan', title: 'Planning', sort: 1 }],
        tasks: [
          { id: 't-s3', bucketId: 'b-week', title: 'Complete S3 reports', status: 'in_progress', category: 'Assessment', description: 'Finish comment banks and grades for all S3 classes before Friday.', notes: '', dueDate: isoOffset(0), priority: 'high', completed: false, checklist: [{ id: 'c1', text: 'Drama classes', done: true }, { id: 'c2', text: 'Art classes', done: true }, { id: 'c3', text: 'Photography', done: false }], attachments: [{ id: 'a1', type: 'link', label: 'Report template', url: 'https://example.com/reports', addedAt: d.toISOString() }], comments: [], sort: 0, createdAt: d.toISOString(), updatedAt: d.toISOString() },
          { id: 't-n5', bucketId: 'b-plan', title: 'Moderate N5 folios', status: 'todo', category: 'Assessment', description: 'Cross-mark folios with colleague before submission deadline.', notes: 'Book room 12 for Tuesday.', dueDate: isoOffset(2), priority: 'high', completed: false, checklist: [], attachments: [], comments: [], sort: 1, createdAt: d.toISOString(), updatedAt: d.toISOString() },
          { id: 't-meet', bucketId: 'b-plan', title: 'Prepare departmental meeting', status: 'waiting', category: 'Meetings', description: 'Waiting on HT approval for agenda item on tracking policy.', notes: '', dueDate: isoOffset(4), priority: 'normal', completed: false, checklist: [{ id: 'c4', text: 'Draft agenda', done: true }, { id: 'c5', text: 'Circulate papers', done: false }], attachments: [], comments: [], sort: 0, createdAt: d.toISOString(), updatedAt: d.toISOString() },
          { id: 't-overdue', bucketId: 'b-week', title: 'Submit trip risk assessment', status: 'todo', category: 'Admin', description: 'Theatre visit risk assessment for parental consent.', notes: '', dueDate: isoOffset(-3), priority: 'high', completed: false, checklist: [], attachments: [], comments: [], sort: 2, createdAt: d.toISOString(), updatedAt: d.toISOString() },
          { id: 't-done', bucketId: 'b-week', title: 'Order darkroom chemicals', status: 'completed', category: 'Admin', description: '', notes: 'PO ref 4421', dueDate: isoOffset(-1), priority: 'low', completed: true, checklist: [], attachments: [], comments: [], sort: 0, createdAt: d.toISOString(), updatedAt: d.toISOString() }
        ]
      }));
    }
  } catch (e) {}
})();
