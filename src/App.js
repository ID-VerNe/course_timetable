import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/zh-cn';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import Modal from 'react-modal';
import { useSwipeable } from 'react-swipeable';
import { SketchPicker } from 'react-color';
import './App.css';

// --- Setup ---
moment.locale('zh-cn');
const localizer = momentLocalizer(moment);
Modal.setAppElement('#root');

// --- Helper Functions ---
const getDayIndex = (day, startOfWeek) => {
  const days = startOfWeek === 1
    ? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    : ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const index = days.indexOf(day.toLowerCase());
  return startOfWeek === 1 ? (index + 1) % 7 : index;
};

function truncateString(str, maxLength) {
  if (str.length <= maxLength) return str;
  const words = str.split(' ');
  let truncated = '';
  for (let i = 0; i < words.length; i++) {
    if ((truncated + words[i]).length <= maxLength) {
      truncated += words[i] + ' ';
    } else {
      break;
    }
  }
  return truncated.trim() + ' ...';
}

// --- Components ---
const CustomEvent = ({ event }) => (
  <div className="event-container">
    <div className="event-title">
      {truncateString(event.resource.courseTitle, 50)}
    </div>
    <div className="event-details">
      <span className="event-venue">{event.resource.venue}</span>
    </div>
    <div className="event-instructor">{event.resource.instructor}</div>
  </div>
);

const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  // Return as rgba with some transparency
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.9)`;
};


const EventModal = ({ isOpen, onRequestClose, event, settings }) => {
  if (!event) return null;
  const { resource } = event;
  const typeKey = resource.type ? resource.type.toLowerCase() : '';
  const courseTypeStyle = {
    backgroundColor: settings.typeColors[typeKey] || '#cccccc',
  };
  const typeDisplayName = settings.courseTypes[typeKey] || resource.type;

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      className="modal"
      overlayClassName="overlay"
    >
      <div className="modal-header">
        <h2>{resource.courseTitle}</h2>
        <span className="modal-course-type" style={courseTypeStyle}>
          {typeDisplayName}
        </span>
        <button onClick={onRequestClose} className="modal-close-btn">&times;</button>
      </div>
      <div className="modal-body">
        <p><strong>课程代码:</strong> {resource.courseCode}</p>
        <p><strong>时间:</strong> {`${moment(event.start).format('YYYY/MM/DD HH:mm')} - ${moment(event.end).format('HH:mm')}`}</p>
        <p><strong>地点:</strong> {resource.venue}</p>
        <p><strong>导师:</strong> {resource.instructor || 'N/A'}</p>
        <p><strong>备注:</strong> {resource.remarks}</p>
      </div>
    </Modal>
  );
};

const CalendarWrapper = ({ children, onSwipeLeft, onSwipeRight }) => {
  const handlers = useSwipeable({
    onSwipedLeft: () => onSwipeLeft(),
    onSwipedRight: () => onSwipeRight(),
    preventScrollOnSwipe: true,
    trackMouse: true,
  });

  const handleWheel = (e) => {
    // Stop the page from scrolling
    e.preventDefault();
    // A positive deltaY indicates scrolling down (or right), a negative value indicates scrolling up (or left)
    if (e.deltaY > 0) {
      onSwipeLeft(); // Corresponds to swiping left (next week)
    } else {
      onSwipeRight(); // Corresponds to swiping right (previous week)
    }
  };

  return <div {...handlers} onWheel={handleWheel}>{children}</div>;
};

const CustomToolbar = ({ label, onNavigate, onUploadClick, onSettingsClick, onEditClick }) => {
  return (
    <div className="rbc-toolbar">
      <span className="rbc-btn-group">
        <button type="button" onClick={() => onNavigate('TODAY')}>Today</button>
        <button type="button" onClick={() => onNavigate('PREV')}>Back</button>
        <button type="button" onClick={() => onNavigate('NEXT')}>Next</button>
      </span>
      <span className="rbc-toolbar-label">{label}</span>
      <span className="rbc-btn-group">
        <button type="button" onClick={onUploadClick}>上传课程JSON</button>
        <button type="button" onClick={onEditClick}>创建/编辑课表</button>
        <button type="button" onClick={onSettingsClick}>设置</button>
      </span>
    </div>
  );
};

const DateRangeEditor = ({ dateRanges, onChange }) => {
  const handleDateChange = (rangeIndex, field, value) => {
    const newRanges = [...dateRanges];
    newRanges[rangeIndex][field] = value;
    onChange(newRanges);
  };

  const addRange = () => {
    onChange([...dateRanges, { startDate: '', endDate: '' }]);
  };

  const removeRange = (rangeIndex) => {
    onChange(dateRanges.filter((_, i) => i !== rangeIndex));
  };

  return (
    <div className="date-range-editor">
      <label>Date Ranges:</label>
      {dateRanges.map((range, index) => (
        <div key={index} className="date-range-item">
          <input type="text" placeholder="YYYY/MM/DD" value={range.startDate} onChange={e => handleDateChange(index, 'startDate', e.target.value)} />
          <span>-</span>
          <input type="text" placeholder="YYYY/MM/DD" value={range.endDate} onChange={e => handleDateChange(index, 'endDate', e.target.value)} />
          <button onClick={() => removeRange(index)} className="remove-btn">-</button>
        </div>
      ))}
      <button onClick={addRange} className="add-btn">+ 添加范围</button>
    </div>
  );
};


const CourseEditor = ({ onClose, settings }) => {
  const [courses, setCourses] = useState({});
  const [activeSemester, setActiveSemester] = useState('');

  useEffect(() => {
    try {
      const storedCourses = localStorage.getItem('coursesData');
      const data = storedCourses ? JSON.parse(storedCourses) : {};
      setCourses(data);
      if (Object.keys(data).length > 0) {
        setActiveSemester(Object.keys(data)[0]);
      }
    } catch (e) {
      setCourses({});
    }
  }, []);

  const handleAddSemester = () => {
    const semesterId = `semester${Object.keys(courses).length + 1}`;
    const newSemester = {
      term: `New Semester ${Object.keys(courses).length + 1}`,
      monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: []
    };
    setCourses(prev => ({ ...prev, [semesterId]: newSemester }));
    setActiveSemester(semesterId);
  };

  const handleDeleteSemester = () => {
    if (!activeSemester || !window.confirm(`Are you sure you want to delete semester "${courses[activeSemester].term}"?`)) {
      return;
    }
    const updatedCourses = { ...courses };
    delete updatedCourses[activeSemester];
    setCourses(updatedCourses);
    const remainingSemesters = Object.keys(updatedCourses);
    setActiveSemester(remainingSemesters.length > 0 ? remainingSemesters[0] : '');
  };

  const handleSemesterTermChange = (e) => {
    if (!activeSemester) return;
    const updatedCourses = { ...courses };
    updatedCourses[activeSemester].term = e.target.value;
    setCourses(updatedCourses);
  };

  const handleAddCourse = (day) => {
    const defaultType = Object.keys(settings.courseTypes)[0] || 'new_type';
    const newCourse = {
      type: defaultType, courseCode: "", courseTitle: "",
      startTime: "09:00", endTime: "11:50", venue: "", instructor: "",
      dateRanges: [{ startDate: "2025/09/01", endDate: "2025/11/30" }],
      remarks: ""
    };
    const updatedCourses = { ...courses };
    updatedCourses[activeSemester][day].push(newCourse);
    setCourses(updatedCourses);
  };

  const handleCourseChange = (day, courseIndex, field, value) => {
    const updatedCourses = { ...courses };
    updatedCourses[activeSemester][day][courseIndex][field] = value;
    setCourses(updatedCourses);
  };

  const handleDeleteCourse = (day, courseIndex) => {
    const updatedCourses = { ...courses };
    updatedCourses[activeSemester][day].splice(courseIndex, 1);
    setCourses(updatedCourses);
  };

  const handleDateRangesChange = (day, courseIndex, newRanges) => {
    const updatedCourses = { ...courses };
    updatedCourses[activeSemester][day][courseIndex].dateRanges = newRanges;
    setCourses(updatedCourses);
  };

  const handleSave = () => {
    localStorage.setItem('coursesData', JSON.stringify(courses));
    alert('课程表已保存！页面将刷新以应用新课表。');
    onClose();
    window.location.reload();
  };

  const handleDownload = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(courses, null, 2)
    )}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = "courses.json";
    link.click();
  };

  return (
    <div className="editor-overlay">
      <div className="editor-panel">
        <div className="editor-header">
          <h2>课程表编辑器</h2>
          <div className="editor-controls">
            <button onClick={handleAddSemester}>添加学期</button>
            {activeSemester && <button onClick={handleDeleteSemester} className="delete-semester-btn">删除当前学期</button>}
            <select value={activeSemester} onChange={e => setActiveSemester(e.target.value)}>
              <option value="" disabled>-- 选择学期 --</option>
              {Object.keys(courses).map(semId => <option key={semId} value={semId}>{courses[semId].term}</option>)}
            </select>
            {activeSemester && (
              <input
                type="text"
                value={courses[activeSemester] ? courses[activeSemester].term : ''}
                onChange={handleSemesterTermChange}
                placeholder="学期名称"
                className="semester-name-input"
              />
            )}
          </div>
          <button onClick={onClose} className="editor-close-btn">&times;</button>
        </div>
        <div className="editor-body">
          {activeSemester && courses[activeSemester] ? (
            Object.keys(courses[activeSemester]).filter(key => key !== 'term').map(day => (
              <div key={day} className="day-editor">
                <div className="day-header">
                  <h3>{day.charAt(0).toUpperCase() + day.slice(1)}</h3>
                  <button onClick={() => handleAddCourse(day)} className="add-course-btn">+ 添加课程</button>
                </div>
                {courses[activeSemester][day].map((course, index) => (
                  <div key={index} className="course-form">
                    <button onClick={() => handleDeleteCourse(day, index)} className="delete-course-btn">×</button>
                    <select value={course.type} onChange={e => handleCourseChange(day, index, 'type', e.target.value)}>
                      {Object.entries(settings.courseTypes).map(([key, name]) => (
                        <option key={key} value={key}>{name}</option>
                      ))}
                    </select>
                    <input type="text" placeholder="Course Code" value={course.courseCode} onChange={e => handleCourseChange(day, index, 'courseCode', e.target.value)} />
                    <input type="text" className="full-width" placeholder="Course Title" value={course.courseTitle} onChange={e => handleCourseChange(day, index, 'courseTitle', e.target.value)} />
                    <input type="time" value={course.startTime} onChange={e => handleCourseChange(day, index, 'startTime', e.target.value)} />
                    <input type="time" value={course.endTime} onChange={e => handleCourseChange(day, index, 'endTime', e.target.value)} />
                    <input type="text" placeholder="Venue" value={course.venue} onChange={e => handleCourseChange(day, index, 'venue', e.target.value)} />
                    <input type="text" placeholder="Instructor" value={course.instructor} onChange={e => handleCourseChange(day, index, 'instructor', e.target.value)} />
                    <div className="full-width">
                      <DateRangeEditor dateRanges={course.dateRanges} onChange={newRanges => handleDateRangesChange(day, index, newRanges)} />
                    </div>
                    <textarea className="full-width" placeholder="Remarks" value={course.remarks} onChange={e => handleCourseChange(day, index, 'remarks', e.target.value)} />
                  </div>
                ))}
              </div>
            ))
          ) : <p>请添加或选择一个学期开始编辑。</p>}
        </div>
        <div className="editor-footer">
          <button onClick={handleDownload}>下载JSON</button>
          <button onClick={handleSave} className="save-btn">保存并使用</button>
        </div>
      </div>
    </div>
  );
};

const SettingsPanel = ({ settings, onChange, onClose }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [displayColorPicker, setDisplayColorPicker] = useState({});
  const importSettingsRef = useRef(null);

  const handleExport = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(localSettings, null, 2)
    )}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = "calendarSettings.json";
    link.click();
  };

  const handleImportClick = () => {
    importSettingsRef.current.click();
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedSettings = JSON.parse(event.target.result);
        if (importedSettings.courseTypes && importedSettings.typeColors) {
          setLocalSettings(importedSettings);
          alert('设置已成功导入！点击保存以应用。');
        } else {
          alert('导入的设置文件格式不正确。');
        }
      } catch (error) {
        alert('文件无效，请确保是正确的JSON格式。');
        console.error("Settings import error:", error);
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleGeneralChange = (e) => {
    const { name, value, type } = e.target;
    setLocalSettings(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value) : value }));
  };

  const handleTypeChange = (oldKey, newName) => {
    const newCourseTypes = { ...localSettings.courseTypes };
    const newTypeColors = { ...localSettings.typeColors };

    if (newName && oldKey !== newName.toLowerCase().replace(/\s+/g, '_')) {
      const newKey = newName.toLowerCase().replace(/\s+/g, '_');
      if (!newCourseTypes[newKey]) {
        newCourseTypes[newKey] = newName;
        newTypeColors[newKey] = newTypeColors[oldKey];
        delete newCourseTypes[oldKey];
        delete newTypeColors[oldKey];
      }
    } else {
      newCourseTypes[oldKey] = newName;
    }
    setLocalSettings(prev => ({ ...prev, courseTypes: newCourseTypes, typeColors: newTypeColors }));
  };

  const handleColorChange = (key, color) => {
    const newTypeColors = { ...localSettings.typeColors, [key]: `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})` };
    setLocalSettings(prev => ({ ...prev, typeColors: newTypeColors }));
  };

  const handleColorInputChange = (key, colorString) => {
    const newTypeColors = { ...localSettings.typeColors, [key]: colorString };
    setLocalSettings(prev => ({ ...prev, typeColors: newTypeColors }));
  };

  const addType = () => {
    const newName = 'New Type';
    const newKey = `new_type_${Date.now()}`;
    const newCourseTypes = { ...localSettings.courseTypes, [newKey]: newName };
    const newTypeColors = { ...localSettings.typeColors, [newKey]: getRandomColor() };
    setLocalSettings(prev => ({ ...prev, courseTypes: newCourseTypes, typeColors: newTypeColors }));
  };

  const removeType = (key) => {
    const newCourseTypes = { ...localSettings.courseTypes };
    const newTypeColors = { ...localSettings.typeColors };
    delete newCourseTypes[key];
    delete newTypeColors[key];
    setLocalSettings(prev => ({ ...prev, courseTypes: newCourseTypes, typeColors: newTypeColors }));
  };

  const handleSave = () => {
    onChange(localSettings);
    onClose();
  };

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <input
          type="file"
          ref={importSettingsRef}
          style={{ display: 'none' }}
          onChange={handleImportFile}
          accept=".json"
        />
        <div className="settings-header">
          <h3>设置</h3>
          <div className="settings-io-buttons">
            <button onClick={handleImportClick} className="icon-btn" title="导入设置">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
              </svg>
            </button>
            <button onClick={handleExport} className="icon-btn" title="导出设置">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="settings-section">
          <h4>课程类型和颜色</h4>
          {Object.entries(localSettings.courseTypes).map(([key, name]) => (
            <div key={key} className="type-setting-item">
              <input type="text" value={name} onChange={e => handleTypeChange(key, e.target.value)} placeholder="Display Name" className="type-name-input" />
              <div className="color-input-wrapper">
                <div
                  className="color-swatch"
                  style={{ backgroundColor: localSettings.typeColors[key] }}
                  onClick={() => setDisplayColorPicker(prev => ({ ...prev, [key]: !prev[key] }))}
                />
                <input
                  type="text"
                  value={localSettings.typeColors[key]}
                  onChange={e => handleColorInputChange(key, e.target.value)}
                  className="color-text-input"
                />
                {displayColorPicker[key] && (
                  <div className="color-picker-popover">
                    <div className="color-picker-cover" onClick={() => setDisplayColorPicker(prev => ({ ...prev, [key]: false }))} />
                    <SketchPicker color={localSettings.typeColors[key]} onChange={color => handleColorChange(key, color)} />
                  </div>
                )}
              </div>
              <button onClick={() => removeType(key)} className="remove-type-btn">-</button>
            </div>
          ))}
          <button onClick={addType} className="add-type-btn">+ 添加类型</button>
        </div>
        <div className="settings-section">
          <h4>日历显示</h4>
          <div className="setting-item">
            <label>开始时间:</label>
            <input type="time" name="minTime" value={localSettings.minTime} onChange={handleGeneralChange} />
          </div>
          <div className="setting-item">
            <label>结束时间:</label>
            <input type="time" name="maxTime" value={localSettings.maxTime} onChange={handleGeneralChange} />
          </div>
          <div className="setting-item">
            <label>每周开始于:</label>
            <select name="startOfWeek" value={localSettings.startOfWeek} onChange={handleGeneralChange}>
              <option value={0}>周日</option>
              <option value={1}>周一</option>
            </select>
          </div>
        </div>
        <div className="settings-actions">
          <button onClick={handleSave}>保存</button>
          <button onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---
const App = () => {
  const [events, setEvents] = useState([]);
  const [dayTypes, setDayTypes] = useState({});
  const [viewDate, setViewDate] = useState(new Date('2025-09-01'));
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [hasCourses, setHasCourses] = useState(false);
  const fileInputRef = useRef(null);

  const [settings, setSettings] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('calendarSettings');
      const defaults = {
        courseTypes: { 'registered': '必修', 'audit': '旁听' },
        typeColors: {
          'registered': 'rgba(59, 141, 211, 0.9)',
          'audit': 'rgba(114, 149, 116, 0.9)'
        },
        minTime: '08:30',
        maxTime: '22:00',
        startOfWeek: 1,
      };
      return savedSettings ? { ...defaults, ...JSON.parse(savedSettings) } : defaults;
    } catch (e) {
      return {
        courseTypes: { 'registered': '必修', 'audit': '旁听' },
        typeColors: {
          'registered': 'rgba(59, 141, 211, 0.9)',
          'audit': 'rgba(114, 149, 116, 0.9)'
        },
        minTime: '08:30',
        maxTime: '22:00',
        startOfWeek: 1,
      };
    }
  });

  useEffect(() => {
    const loadCourseData = () => {
      let coursesData;
      try {
        const storedCourses = localStorage.getItem('coursesData');
        if (storedCourses) {
          coursesData = JSON.parse(storedCourses);
          setHasCourses(Object.keys(coursesData).length > 0);
        } else {
          coursesData = {};
          setHasCourses(false);
        }
      } catch (e) {
        console.error("Failed to parse courses data from localStorage", e);
        coursesData = {};
        setHasCourses(false);
      }

      const newEvents = [];
      const newDayTypes = {};
      let earliestDate = null;

      Object.values(coursesData).forEach(semesterData => {
        Object.keys(semesterData).forEach(day => {
          if (Array.isArray(semesterData[day])) {
            const dayIndex = getDayIndex(day, settings.startOfWeek);
            semesterData[day].forEach(course => {
              course.dateRanges.forEach(range => {
                let current = moment(range.startDate, 'YYYY/MM/DD');
                const end = moment(range.endDate, 'YYYY/MM/DD');

                if (!earliestDate || current.isBefore(earliestDate)) {
                  earliestDate = current.clone();
                }

                while (current.isSameOrBefore(end)) {
                  if (current.day() === dayIndex) {
                    const dateStr = current.format('YYYY-MM-DD');
                    const courseType = course.type ? course.type.toLowerCase() : ''; // Use the actual type key
                    
                    // This logic might need refinement based on desired priority,
                    // but for now, we just mark the day with the first type found.
                    if (!newDayTypes[dateStr]) {
                      newDayTypes[dateStr] = courseType;
                    }

                    newEvents.push({
                      title: `${course.courseCode} - ${course.courseTitle}`,
                      start: moment(current).set({ hour: course.startTime.split(':')[0], minute: course.startTime.split(':')[1] }).toDate(),
                      end: moment(current).set({ hour: course.endTime.split(':')[0], minute: course.endTime.split(':')[1] }).toDate(),
                      allDay: false,
                      resource: course,
                    });
                  }
                  current.add(1, 'days');
                }
              });
            });
          }
        });
      });

      if (earliestDate) {
        setViewDate(earliestDate.toDate());
      }

      setEvents(newEvents);
      setDayTypes(newDayTypes);
    };

    loadCourseData();
  }, [settings]);

  const handleSettingsChange = (newSettings) => {
    localStorage.setItem('calendarSettings', JSON.stringify(newSettings));
    setSettings(newSettings);
    // Optional: force re-render if necessary, though state change should do it.
    window.location.reload();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        // Basic validation can be added here if needed
        localStorage.setItem('coursesData', JSON.stringify(json));
        alert('课程文件上传成功！页面将刷新以应用更改。');
        window.location.reload();
      } catch (error) {
        alert('文件无效，请确保是正确的JSON格式。');
        console.error("JSON parsing error:", error);
      }
    };
    reader.readAsText(file);
  };

  const handleSelectEvent = useCallback((event) => {
    setSelectedEvent(event);
    setModalIsOpen(true);
  }, []);

  const dayPropGetter = useCallback((date) => {
    const dateStr = moment(date).format('YYYY-MM-DD');
    const typeKey = dayTypes[dateStr];
    if (!typeKey) return {};
    
    // We can't dynamically create CSS classes easily, so we'll rely on event colors.
    // However, we can add a generic class if needed.
    return {
      className: 'has-event-on-day',
      // style: { backgroundColor: settings.typeColors[typeKey] + '20' } // Example: add a light background
    };
  }, [dayTypes, settings.typeColors]);

  const eventStyleGetter = useCallback((event) => {
    const typeKey = event.resource.type ? event.resource.type.toLowerCase() : '';
    return {
      style: {
        backgroundColor: settings.typeColors[typeKey] || '#cccccc',
      },
    };
  }, [settings.typeColors]);

  const handleSwipe = (direction) => {
    const newDate = moment(viewDate).add(direction, 'week').toDate();
    setViewDate(newDate);
  };

  const getCulture = () => {
    moment.locale(settings.startOfWeek === 1 ? 'zh-cn' : 'en-us');
    return settings.startOfWeek === 1 ? 'zh-cn' : 'en-us';
  };

  return (
    <div className="app-container">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileUpload}
        accept=".json"
      />

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={handleSettingsChange}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showEditor && <CourseEditor onClose={() => setShowEditor(false)} settings={settings} />}

      <CalendarWrapper onSwipeLeft={() => handleSwipe(1)} onSwipeRight={() => handleSwipe(-1)}>
        <Calendar
          localizer={localizer}
          events={events}
          date={viewDate}
          onNavigate={(date) => setViewDate(date)}
          onSelectEvent={handleSelectEvent}
          dayPropGetter={dayPropGetter}
          eventPropGetter={eventStyleGetter}
          components={{
            event: CustomEvent,
            toolbar: (toolbarProps) => (
              <CustomToolbar
                {...toolbarProps}
                onUploadClick={() => fileInputRef.current && fileInputRef.current.click()}
                onSettingsClick={() => setShowSettings(true)}
                onEditClick={() => setShowEditor(true)}
              />
            ),
          }}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 'calc(100vh - 40px)' }}
          defaultView="week"
          views={['week']}
          step={30}
          showMultiDayTimes
          min={moment(settings.minTime, 'HH:mm').toDate()}
          max={moment(settings.maxTime, 'HH:mm').toDate()}
          culture={getCulture()}
        />
        {!hasCourses && (
          <div className="no-courses-overlay">
            <div className="no-courses-message">
              <h2>欢迎使用课程表</h2>
              <p>看起来您还没有课程数据，请选择一个开始方式：</p>
              <div className="no-courses-actions">
                <button onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                  上传课程JSON
                </button>
                <button onClick={() => setShowEditor(true)} className="secondary">
                  创建新课表
                </button>
              </div>
            </div>
          </div>
        )}
      </CalendarWrapper>
      <EventModal
        isOpen={modalIsOpen}
        onRequestClose={() => setModalIsOpen(false)}
        event={selectedEvent}
        settings={settings}
      />
    </div>
  );
};

export default App;
